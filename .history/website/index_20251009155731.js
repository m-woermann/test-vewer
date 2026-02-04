import * as THREE from 'three';
import { GLTFLoader } from 'jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'jsm/loaders/DRACOLoader.js';

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

// Interaction state for clickable instanced meshes
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const instancedMeshes = []; // store InstancedMesh references for raycasting
let selectedMesh = null; // Currently selected InstancedMesh
let selectedInstance = -1; // Currently selected instance ID

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const spotLight = new THREE.SpotLight(0xffffff, 3);
spotLight.castShadow = true;
spotLight.angle = Math.PI / 4;
spotLight.penumbra = 0.2;
spotLight.decay = 0.1;
spotLight.distance = 5000;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
scene.add(spotLight);

let targets1 = new THREE.Object3D();
scene.add(targets1);
targets1.position.set(0, 600, 0);
spotLight.target = targets1;



const helper = new THREE.SpotLightHelper(spotLight);
scene.add(helper);

// Offset from the camera where the spotlight should be placed (tweak as needed)
// lightOffset controls where the spotlight sits relative to the camera each frame.
// Increase Z to move the light farther in front of the camera, increase Y to raise it higher.

const lightOffset = new THREE.Vector3(0, 300, 800);
 
const planeGeometry = new THREE.PlaneGeometry(8000, 6000);
const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8c8c8c,
    roughness: 0.2,
    metalness: 0.0,
    dithering: true
});

const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = 0;
plane.position.z = -500;
plane.receiveShadow = true;
scene.add(plane);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//gltf Model Load
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let model;
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);

loader.load(
    'speaker.glb',
    function (gltf) {
        model = gltf.scene;

        if (!model) {
            console.error("Error Load");
            return;
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);
        model.position.y = 50;
        model.scale.set(1, 1, 1);

        model.traverse((child) => {
            if (child.isMesh && child.geometry) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.needsUpdate = true;
                        });
                        console.log("Multiple materials for mesh:", child.name);
                    } else {
                        child.material.needsUpdate = true;
                        console.log("Material type for", child.name, ":", child.material.type);
                        if (child.material.map) {
                            console.log("Material has texture map");
                        }
                    }
                }
            }
        });

        model.receiveShadow = true;

        // Create InstancedMeshes: 3 speakers side-by-side
        const instances = 6;
        const spacing = 270; // distance between speaker centers on X axis

        // For each mesh inside the loaded model, create an InstancedMesh
        model.traverse((child) => {
            if (child.isMesh && child.geometry) {
                // Ensure material is not an array (InstancedMesh requires a single Material)
                let mat = child.material;
                if (Array.isArray(mat)) {
                    mat = mat[0];
                }

                // Clone geometry and material for the instanced mesh
                const geom = child.geometry.clone();
                const material = mat.clone ? mat.clone() : mat;

                const inst = new THREE.InstancedMesh(geom, material, instances);
                inst.castShadow = true;
                inst.receiveShadow = true;

                const dummy = new THREE.Object3D();
                const originalMatrices = [];

                for (let i = 0; i < instances; i++) {
                    // Position each instance along X
                    dummy.position.set((i - (instances - 1) / 2) * spacing, child.position.y + 50, child.position.z);
                    dummy.rotation.copy(child.rotation);
                    dummy.scale.copy(child.scale);
                    dummy.updateMatrix();
                    inst.setMatrixAt(i, dummy.matrix);
                    // store original matrix clone for this instance
                    originalMatrices.push(dummy.matrix.clone());
                }

                inst.instanceMatrix.needsUpdate = true;
                scene.add(inst);

                // Track instanced mesh for interaction
                instancedMeshes.push(inst);
            }
        });

        console.log("Added instanced speaker(s)", instances);
    },
    undefined,
    function (error) {
        console.error("Load Error GLB", error);
    }
);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//camara and renderer
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



//Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};
window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;  
    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();   

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});



// Camera
const camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 5000);
camera.position.set(0, 50, 1500);
camera.lookAt(0, 5000, 0);
scene.add(camera);
// Camera look target vector
const cameraTarget = new THREE.Vector3(0, 50, 0);

// Camera pitch in degrees (positive looks downwards). Set once to control vertical look angle.
// Example: 10 means camera looks 10 degrees down from horizontal. Use 0 for straight ahead.
const cameraPitchDeg = -20; // <-- set this value once to change vertical angle
const cameraPitchRad = THREE.MathUtils.degToRad(cameraPitchDeg);

//Renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.shadowMap.enabled = true;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.background = new THREE.Color(0x8c8c8c);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//interaction handling
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Interaction state and constants for panning and selection
const panSpeed = 0.5; // world units per pixel
const panDamping = 6.0; // damping rate per second
const dragThreshold = 4; // pixels
const clock = new THREE.Clock();

// State variables
let isPanning = false;
let lastPanX = 0;
let isDragging = false;
let totalDragMovement = 0;
let panVelocity = 0;

// Handle selection of instances
function handleSelection(event) {
    // Convert click to normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    // Find closest intersection
    let closest = null;
    let closestDist = Infinity;

    for (const mesh of instancedMeshes) {
        const intersects = raycaster.intersectObject(mesh);
        if (intersects.length > 0 && intersects[0].distance < closestDist) {
            closest = intersects[0];
            closestDist = intersects[0].distance;
        }
    }

    if (!closest) return;

    const instanceId = closest.instanceId;
    if (instanceId === undefined) return;

    const mesh = closest.object;

    // If clicking the same instance, deselect it
    if (selectedMesh === mesh && selectedInstance === instanceId) {
        // Reset position
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(instanceId, matrix);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);
        position.z -= 80;
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(instanceId, matrix);
        mesh.instanceMatrix.needsUpdate = true;
        
        selectedMesh = null;
        selectedInstance = -1;
        return;
    }

    // Reset previous selection if any
    if (selectedMesh && selectedInstance !== -1) {
        const matrix = new THREE.Matrix4();
        selectedMesh.getMatrixAt(selectedInstance, matrix);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);
        position.z -= 80;
        matrix.compose(position, quaternion, scale);
        selectedMesh.setMatrixAt(selectedInstance, matrix);
        selectedMesh.instanceMatrix.needsUpdate = true;
    }

    // Select new instance
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(instanceId, matrix);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    position.z += 80;
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(instanceId, matrix);
    mesh.instanceMatrix.needsUpdate = true;

    selectedMesh = mesh;
    selectedInstance = instanceId;
}

// Handle mouse interactions
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left mouse button
        isPanning = true;
        isDragging = false;
        totalDragMovement = 0;
        lastPanX = e.clientX;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    
    const dx = e.clientX - lastPanX;
    totalDragMovement += Math.abs(dx);
    
    // Only start panning after threshold is exceeded
    if (totalDragMovement > dragThreshold) {
        isDragging = true;
        
        // Move camera
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const amount = -dx * panSpeed;
        camera.position.addScaledVector(right, amount);
        cameraTarget.addScaledVector(right, amount);
        
        // Set velocity for inertia
        panVelocity = -dx * panSpeed * 60;
    }
    
    lastPanX = e.clientX;
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) { // Left mouse button
        if (!isDragging && totalDragMovement <= dragThreshold) {
            // This was a click, not a drag - perform selection
            handleSelection(e);
        }
        isPanning = false;
        isDragging = false;
    }
});


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//pan camara
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// Pointer drag -> horizontal pan
let isPointerDown = false;
let lastPointerX = 0;
let dragMoved = false;
const dragThreshold = 4; // px
const panSpeed = 0.5; // world units per pixel (direct translation)
let lastDragDx = 0;
let panVelocity = 0; // world units per second
const panDamping = 6.0; // damping rate (per second)
const clock = new THREE.Clock();

// Track total movement during drag
let totalDragMovement = 0;

function onPointerDownPan(e) {
    // Only handle right mouse button for panning
    if (e.button !== 2) return;
    
    isPointerDown = true;
    lastPointerX = e.clientX;
    dragMoved = false;
    totalDragMovement = 0;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
}

function onPointerMovePan(e) {
    if (!isPointerDown) return;
    const dx = e.clientX - lastPointerX;
    totalDragMovement += Math.abs(dx);
    if (totalDragMovement > dragThreshold) dragMoved = true;
    lastPointerX = e.clientX;
    lastDragDx = dx;
    
    if (dragMoved) {
        // Only pan if we've exceeded drag threshold
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const amount = -dx * panSpeed;
        camera.position.addScaledVector(right, amount);
        cameraTarget.addScaledVector(right, amount);
    }
}

function onPointerUpPan(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);

    // Only apply inertia if we were actually dragging
    if (dragMoved && Math.abs(lastDragDx) > 0) {
        panVelocity = -lastDragDx * panSpeed * 60;
    }
}

// Enable context menu prevention for right-click panning
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Pan with right mouse button
canvas.addEventListener('pointerdown', onPointerDownPan);
canvas.addEventListener('pointermove', onPointerMovePan);
canvas.addEventListener('pointerup', onPointerUpPan);



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//render loop
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const animate = () => {
    requestAnimationFrame(animate);
    
   
    const delta = clock.getDelta();
    // apply velocity with damping
    if (Math.abs(panVelocity) > 1e-3) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const move = panVelocity * delta;
        camera.position.addScaledVector(right, move);
        cameraTarget.addScaledVector(right, move);
        // apply damping to velocity
        panVelocity = panVelocity * Math.exp(-panDamping * delta);
        if (Math.abs(panVelocity) < 1e-3) panVelocity = 0;
    }
   
    
    // Keep camera at fixed angle while allowing position changes
    const forwardNow = new THREE.Vector3();
    camera.getWorldDirection(forwardNow);
    const horizontalDir = new THREE.Vector3(forwardNow.x, 0, forwardNow.z).normalize();
    const pitchedDir = new THREE.Vector3();
    pitchedDir.copy(horizontalDir);
    pitchedDir.y = -Math.sin(cameraPitchRad);
    pitchedDir.normalize();
    const lookDistance = 2000;
    cameraTarget.copy(camera.position).addScaledVector(pitchedDir, lookDistance);
    camera.lookAt(cameraTarget);
    
    // Keep lighting in sync with camera
    spotLight.position.copy(camera.position).add(lightOffset);
    targets1.position.copy(cameraTarget);
    // keep the SpotLightHelper in sync with the light/target movement
    helper.update();
    renderer.render(scene, camera);
};
animate();