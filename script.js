import * as THREE from '../modules/three.module.js';
//import { OrbitControls } from '../modules/OrbitControls.js';
import { FlyControls } from '../modules/FlyControls.js';
///// variables
//AMMO 
let physicsWorld;
let ball, newCube, particles;
let rigidBodies = [];
let tmpTransform = undefined;
let cbContactPairResult;
const lifeSpan = 0.85;
let IsCounter = 0;
let targets = [];

//THREE
let scene, camera, renderer, clock; 
//let orbitControls;
let flyControls;
let raycaster = new THREE.Raycaster();
let tmpPos = new THREE.Vector3();
let mouseCoords = new THREE.Vector2();
//let dummyBall;
let ballInWorld = false;

///// audios
const audioListener = new THREE.AudioListener();

const audioLoader = new THREE.AudioLoader();
const bgmSound = new THREE.Audio(audioListener); 
audioLoader.load('./audios/sas1009.mp3', function(buffer){
     bgmSound.setBuffer(buffer);
     bgmSound.setLoop(true);
     bgmSound.setVolume(0.1);
     bgmSound.play();     
});

const shootingSound = new THREE.Audio(audioListener);
audioLoader.load('./audios/hit.wav', function(buffer){
     shootingSound.setBuffer(buffer);
     shootingSound.setLoop(false);
     shootingSound.setVolume(0.3);
});

// apply box collision sound
const boxSound = new THREE.PositionalAudio(audioListener);
audioLoader.load('./audios/box-short.mp3', function(buffer){
     boxSound.setBuffer(buffer);
     boxSound.setLoop(false);
     boxSound.setRefDistance(100);
})
const boxesSound = new THREE.PositionalAudio(audioListener);
audioLoader.load('./audios/boxes-short.mp3', function(buffer){
     boxesSound.setBuffer(buffer);
     boxesSound.setLoop(false);
     boxesSound.setVolume(0.5);
     boxesSound.setRefDistance(300);
     
})

///// init Ammo function
Ammo().then(start);

function start(){
     tmpTransform = new Ammo.btTransform();

     initPhysicsWorld();
     initGraphicsWorld();

     createParticles();
     createGround();
     createTargets();
     createDropCube();
     createGridCubes();
     createGridCubesLeft();
     //createDummyBall();
     addEventHandler();
     setupContactPairResultCallback();
     render();
};

function initPhysicsWorld(){
     let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
     dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
     overlappingPairCache = new Ammo.btDbvtBroadphase(),
     solver = new Ammo.btSequentialImpulseConstraintSolver();
     
     physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
     physicsWorld.setGravity(new Ammo.btVector3(0, -9.81, 0));
}



function initGraphicsWorld(){
     clock = new THREE.Clock();
     scene = new THREE.Scene();
     scene.background = new THREE.Color(0x222222);

     camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 1, 1000);
     camera.position.set(0, 5, 75);
     camera.lookAt(new THREE.Vector3(0, 0, 0));
     camera.add(audioListener);
     renderer = new THREE.WebGLRenderer({ antialias: true});
     renderer.setPixelRatio(window.devicePixelRatio);
     renderer.setSize(window.innerWidth, window.innerHeight);
     document.body.appendChild(renderer.domElement);
     renderer.shadowMap.enabled = true;
     //renderer.outputEncoding = THREE.sRGBEncoding();

     const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
     scene.add(ambientLight);

     const dirLight = new THREE.DirectionalLight(0xffffff, 2);
     dirLight.position.set(60, 100, 50);
     scene.add(dirLight);
     dirLight.castShadow = true;
     dirLight.shadow.mapSize.width = 1024;
     dirLight.shadow.mapSize.height = 1024;
     let d = 50;
     dirLight.shadow.camera.left = -d;
     dirLight.shadow.camera.right = d;
     dirLight.shadow.camera.top = d;
     dirLight.shadow.camera.bottom = -d;

     //orbitControls = new OrbitControls(camera, renderer.domElement);
     //orbitControls.update();

     //flyControls
     flyControls = new FlyControls(camera, renderer.domElement);
     flyControls.movementSpeed = 100;
     flyControls.rollSpeed = Math.PI / 12;
     flyControls.autoForward = false;
     flyControls.dragToLook = true;
     

     const gridHelper = new THREE.GridHelper(10, 10);
     scene.add(gridHelper);
}
/////Particles/////
function createParticles(){
     const particleGeometry = new THREE.BufferGeometry();
     const count = 3000;
     const positions = new Float32Array(count * 3);
     for(let i = 0; i < count * 3; i++){
          positions[i] = (Math.random() - 0.5) * 300;
     }
     particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

     const particleMaterial = new THREE.PointsMaterial();
     particleMaterial.size = 0.5;
     particleMaterial.sizeAttenuation = true;

     particles = new THREE.Points(particleGeometry, particleMaterial);
     scene.add(particles);

}

function createCube(mass, scale, position, color, quaternion, name){
     const cubeGeometry = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
     const cubeMaterial = new THREE.MeshPhongMaterial({color: color});
     newCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
     newCube.position.set(position.x, position.y, position.z);
     newCube.name = name;
     scene.add(newCube);  
     newCube.castShadow = true;
     newCube.receiveShadow = true;
     newCube.add(boxSound);   

     //ammo
     let transform = new Ammo.btTransform();
     transform.setIdentity();
     transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
     transform.setRotation(new Ammo.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w));
     let defaultMotionState = new Ammo.btDefaultMotionState(transform);

     let structColShape = new Ammo.btBoxShape(new Ammo.btVector3(scale.x * 0.5, scale.y * 0.5, scale.z * 0.5));
     structColShape.setMargin(0.05);

     let localInertia = new Ammo.btVector3(0, 0, 0);
     structColShape.calculateLocalInertia(mass, localInertia);
     let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, defaultMotionState, structColShape, localInertia);

     let rbBody = new Ammo.btRigidBody(rbInfo);
     physicsWorld.addRigidBody(rbBody);
     rbBody.setFriction(0.8);
     rbBody.setRestitution(0.5);
     newCube.userData.physicsBody = rbBody;
     if(mass > 0){
          rigidBodies.push(newCube);
          targets.push(newCube);  
     }       
}

function createGround(){
     createCube(0, 
          new THREE.Vector3(60, 2, 50), 
          new THREE.Vector3(5, -5, 30), 
          0xd4892e, 
          {x: 0, y: 0, z: 0, w: 1},
          'ground'
     );     
}

function createTargets(){
     for(let i = 0; i < 3; i++){
          createCube(5 + (5 * i),
               new THREE.Vector3(5, 2 + (3 * i), 3),
               new THREE.Vector3(8 * i, 5, 50),
               Math.random() * 0xffffff,
               {x: 0, y: 0, z: 0, w: 1},
               'target'
          )
     }
}
function createDropCube(){
     createCube(10, 
          new THREE.Vector3(12, 3, 10),
          new THREE.Vector3(-4, 60, 32),
          0xfc05e9,
          {x: 0.383, y: 0, z: 0.383, w: 0.972},
          'target')
}
function createGridCubes(){
     for (let j = 0; j < 16; j += 2.2){
          for (let i = 0; i < 32; i += 2.1){
               createCube(2, new THREE.Vector3(2, 2, 1.5), new THREE.Vector3(i, j, 35), 
               0xffffff * Math.random(),
               {x: 0, y: 0, z: 0, w: 1},
               'target')
          }
     }     
};

function createGridCubesLeft(){
     for (let j = 0; j < 16; j += 2.2){
          for (let i = 0; i < 32; i += 2.1){
               createCube(4, new THREE.Vector3(2, 2, 1.5), new THREE.Vector3(-15, j, i + 20), 
               0xffffff * Math.random(),
               {x: 0, y: 0, z: 0, w: 1},
               'target')
          }
     }     
}

function addEventHandler(){
     window.addEventListener('mousedown', onMousedown, false);
     window.addEventListener('resize', onWindowResize, false);
};

/* function createDummyBall(){
     dummyBall = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshPhongMaterial({emissive: 0x3f53f5, emissiveIntensity: 0.5}));
     raycaster.setFromCamera(mouseCoords, camera);
     tmpPos.copy(raycaster.ray.direction);
     tmpPos.add(raycaster.ray.origin);
     dummyBall.position.set(tmpPos.x, tmpPos.y, tmpPos.z -1);
     scene.add(dummyBall);  
    // dummyBall disappear when camera moves??? 
    //can use gsap???
} */

function onMousedown(e){
     if(shootingSound.isPlaying){
          shootingSound.isPlaying = false;
          shootingSound.play();
     } else {
          shootingSound.play();
          shootingSound.isPlaying = true;
     }
     
     if(ballInWorld) return;
     mouseCoords.set(
           (e.clientX/window.innerWidth) * 2 - 1,
           -(e.clientY/window.innerHeight) * 2 + 1
     )
     raycaster.setFromCamera(mouseCoords, camera);
     tmpPos.copy(raycaster.ray.direction);
     tmpPos.add(raycaster.ray.origin);

     let pos = {x: tmpPos.x, y: tmpPos.y, z: tmpPos.z - 5};
     let radius = 1.2;
     let quat = {x: 0, y: 0, z: 0, w: 1};
     let mass = 1.5;

     //ball
      ball = new THREE.Mesh(new THREE.SphereGeometry(radius),
     new THREE.MeshPhongMaterial({emissive: 0x3f53f5, emissiveIntensity: 0.5}));
     ball.position.set(pos.x, pos.y, pos.z);
     scene.add(ball);
     ball.castShadow = true;
     ball.receiveShadow = true;

     //ammo
     let transform = new Ammo.btTransform();
     transform.setIdentity();
     transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
     transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
     let defaultMotionState = new Ammo.btDefaultMotionState(transform);

     let structColShape = new Ammo.btSphereShape(radius);
     structColShape.setMargin(0.05);

     let localInertia = new Ammo.btVector3(0, 0, 0);
     structColShape.calculateLocalInertia(mass, localInertia);
     let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, defaultMotionState, structColShape, localInertia);

     let rbBody = new Ammo.btRigidBody(rbInfo);
     physicsWorld.addRigidBody(rbBody);
     
     //raycaster.setFromCamera(mouseCoords, camera);
     tmpPos.copy(raycaster.ray.direction);
     tmpPos.multiplyScalar(50);
     rbBody.setLinearVelocity(new Ammo.btVector3(tmpPos.x, tmpPos.y, tmpPos.z))
     rbBody.threeObject = ball;
     rbBody.setFriction(0.8);
     rbBody.setRestitution(0.3);     
     ball.userData.physicsBody = rbBody;
     rigidBodies.push(ball); 
     ballInWorld = true;    
}
console.log(targets);

///// for collision Check /////
function contact0(){
     cbContactPairResult.hasContact = false;
     physicsWorld.contactPairTest(
          ball.userData.physicsBody,
          targets[0].userData.physicsBody,
          cbContactPairResult
     )
     if(!cbContactPairResult.hasContact) return;
     boxSound.setVolume(0.2)
     //boxSound.play();
     if(boxSound.isPlaying){
          boxSound.isPlaying = false;
          boxSound.pause();
     } else {
          boxSound.play();
          boxSound.isPlaying = true;
     }
}
function contact1(){
     cbContactPairResult.hasContact = false;
     physicsWorld.contactPairTest(
          ball.userData.physicsBody,
          targets[1].userData.physicsBody,
          cbContactPairResult
     )
     if(!cbContactPairResult.hasContact) return;
     boxSound.setVolume(0.5);
     if(boxSound.isPlaying){
          boxSound.isPlaying = false;
          boxSound.pause();
     } else {
          boxSound.play();
          boxSound.isPlaying = true;
     }
}     
function contact2(){
     cbContactPairResult.hasContact = false;
     physicsWorld.contactPairTest(
          ball.userData.physicsBody,
          targets[2].userData.physicsBody,
          cbContactPairResult
     )
     if(!cbContactPairResult.hasContact) return;
     boxSound.setVolume(0.8);
     if(boxSound.isPlaying){
          boxSound.isPlaying = false;
          boxSound.pause();
     } else {
          boxSound.play();
          boxSound.isPlaying = true;
     }
}
function contact3(){
     cbContactPairResult.hasContact = false;
     physicsWorld.contactPairTest(
          ball.userData.physicsBody,
          targets[3].userData.physicsBody,
          cbContactPairResult
     )
     if(!cbContactPairResult.hasContact) return;
     boxSound.setVolume(1);
     if(boxSound.isPlaying){
          boxSound.isPlaying = false;
          boxSound.pause();
     } else {
          boxSound.play();
          boxSound.isPlaying = true;
     }
}

function contact4(){
     cbContactPairResult.hasContact = false;
     //console.log(targets);
     physicsWorld.contactPairTest(
          ball.userData.physicsBody,
          targets[4].userData.physicsBody,
          cbContactPairResult
     )
     if(!cbContactPairResult.hasContact) return;
     boxSound.setVolume(1);
     if(boxSound.isPlaying){
          boxSound.isPlaying = false;
          boxSound.pause();
     } else {
          boxSound.play();
          boxSound.isPlaying = true;
     }
}
function contact5(){
     cbContactPairResult.hasContact = false;
     for(let i = 4; i < 256; i++){
          physicsWorld.contactPairTest(
          ball.userData.physicsBody,
          targets[i].userData.physicsBody,
          cbContactPairResult
          )
     }
     
     if(!cbContactPairResult.hasContact) return;
     boxesSound.setVolume(0.3);
     if(boxesSound.isPlaying){
          boxesSound.isPlaying = false;
          boxesSound.play();
     } else {
          boxesSound.play();
          boxesSound.isPlaying = true;
     }
}
function setupContactPairResultCallback(){
     cbContactPairResult = new Ammo.ConcreteContactResultCallback();
     cbContactPairResult.hasContact = false;
     cbContactPairResult.addSingleResult = function(cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1){
          let contactPoint = Ammo.wrapPointer(cp, Ammo.btManifoldPoint);
          const distance = contactPoint.getDistance();
          if(distance > 0) return;
          this.hasContact = true;
     }     
}


function updatePhysicsWorld(deltaTime){
     physicsWorld.stepSimulation(deltaTime, 10);
     for(let i = 0; i < rigidBodies.length; i++){
          let graphicsObj = rigidBodies[i];
          let physicsObj = graphicsObj.userData.physicsBody;
          let motionState = physicsObj.getMotionState();
          if(motionState){
               motionState.getWorldTransform(tmpTransform);
               let newPos = tmpTransform.getOrigin();
               let newQuat = tmpTransform.getRotation();
               graphicsObj.position.set(newPos.x(), newPos.y(), newPos.z());
               graphicsObj.quaternion.set(newQuat.x(), newQuat.y(), newQuat.z(), newQuat.w());
          } 
     }     
}

function onWindowResize(){
     camera.aspect = window.innerWidth/window.innerHeight;
     camera.updateProjectionMatrix();
     renderer.setSize(window.innerWidth, window.innerHeight);
}

function render(){
     let deltaTime = clock.getDelta();
     particles.rotation.z += deltaTime * 0.0125;
     flyControls.update(0.002);
     // for check collision
     if(ballInWorld){
          IsCounter += deltaTime;
          contact0();
          contact1();
          contact2();
          contact3();
          contact4();
          contact5();
     }
     if(IsCounter > lifeSpan){
          //physicsWorld.removeRigidBody(ball.userData.physicsBody);
          //scene.remove(ball);
          IsCounter = 0;
          ballInWorld = false;
     }

     updatePhysicsWorld(deltaTime);
     renderer.render(scene, camera);
     requestAnimationFrame(render);
}

