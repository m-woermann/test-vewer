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
const instancedBaseScale = new Map(); // base scale per instanced mesh
const selectedInstances = new Map(); // Map(instancedMesh -> Set(instanceId))

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 3);
spotLight.position.set(0, 3000,1500);
spotLight.castShadow = true;
spotLight.angle = Math.PI / 4;
spotLight.penumbra = 0.2;
spotLight.decay = 0.1;
spotLight.distance = 2000;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
scene.add(spotLight);

let targets1 = new THREE.Object3D();
scene.add(targets1);
spotLight.target = targets1;

//const helper = new THREE.SpotLightHelper(spotLight);
//scene.add(helper);

const planeGeometry = new THREE.PlaneGeometry(8000, 2000);
const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8c8c8c,
    roughness: 0.2,
    metalness: 0.0,
    dithering: true
});

const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = 0;
plane.receiveShadow = true;
scene.add(plane);


// gltf Model Load
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

                for (let i = 0; i < instances; i++) {
                    // Position each instance along X
                    dummy.position.set((i - (instances - 1) / 2) * spacing, child.position.y + 50, child.position.z);
                    dummy.rotation.copy(child.rotation);
                    dummy.scale.copy(child.scale);
                    dummy.updateMatrix();
                    inst.setMatrixAt(i, dummy.matrix);
                }

                inst.instanceMatrix.needsUpdate = true;
                scene.add(inst);

                // Track instanced mesh for interaction
                instancedMeshes.push(inst);
                instancedBaseScale.set(inst.uuid, child.scale.clone());
                selectedInstances.set(inst.uuid, new Set());
            }
        });

        console.log("Added instanced speaker(s)", instances);
    },
    undefined,
    function (error) {
        console.error("Load Error GLB", error);
    }
);


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
camera.position.set(0, 500, 1500);
camera.lookAt(0, 1000, 0);
scene.add(camera);
// Camera look target (we won't use OrbitControls; move camera and target directly)
const cameraTarget = new THREE.Vector3(0, 50, 0);

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



// Pointer/click handling for instanced meshes
function onPointer(event) {
    // Calculate normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    // Raycast against all instanced meshes
    const intersects = [];
    for (const inst of instancedMeshes) {
        const hits = raycaster.intersectObject(inst);
        if (hits && hits.length) intersects.push(...hits.map(h => ({ hit: h, inst }))); 
    }

    if (intersects.length === 0) return;

    // Use closest hit
    intersects.sort((a, b) => a.hit.distance - b.hit.distance);
    const { hit, inst } = intersects[0];
    const instanceId = hit.instanceId;
    if (instanceId === undefined || instanceId === null) return;

    // Toggle selection: scale up if not selected, revert if selected
    const selectedSet = selectedInstances.get(inst.uuid);
    const isSelected = selectedSet.has(instanceId);

    // Read current matrix, pos, and set matrix back
    const matrix = new THREE.Matrix4();
    inst.getMatrixAt(instanceId, matrix);
    const dummy = new THREE.Object3D();
    dummy.matrix.copy(matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    if (!isSelected) {
        dummy.position.z += 80;
        selectedSet.add(instanceId);
        console.log('Selected instance', instanceId, 'of', inst.uuid);
    } else {
        // revert to posssition
        dummy.position.z += -80;
        selectedSet.delete(instanceId);
        console.log('Deselected instance', instanceId, 'of', inst.uuid);
    }

    dummy.updateMatrix();
    inst.setMatrixAt(instanceId, dummy.matrix);
    inst.instanceMatrix.needsUpdate = true;
}



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

function onPointerDownPan(e) {
    isPointerDown = true;
    lastPointerX = e.clientX;
    dragMoved = false;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
}

function onPointerMovePan(e) {
    if (!isPointerDown) return;
    const dx = e.clientX - lastPointerX;
    if (Math.abs(dx) > dragThreshold) dragMoved = true;
    lastPointerX = e.clientX;
    lastDragDx = dx;
    // immediate pan: move camera and target horizontally by dx
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const amount = -dx * panSpeed;
    camera.position.addScaledVector(right, amount);
    cameraTarget.addScaledVector(right, amount);
}

function onPointerUpPan(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);
    // if we dragged, convert last drag delta to velocity for inertia
    if (dragMoved && Math.abs(lastDragDx) > 0) {
        // lastDragDx is pixels per frame — convert to world units/sec approximate
        panVelocity = -lastDragDx * panSpeed * 60; // heuristic
    } else {
        // treat as click -> perform selection
        onPointer(e);
    }
}

canvas.addEventListener('pointerdown', onPointerDownPan);
canvas.addEventListener('pointermove', onPointerMovePan);
canvas.addEventListener('pointerup', onPointerUpPan);

// Render Loop
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
        // exponential decay
        panVelocity = panVelocity * Math.exp(-panDamping * delta);
        // cut tiny velocities
        if (Math.abs(panVelocity) < 1e-3) panVelocity = 0;
    }
    // Make the camera look at the target each frame
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
};
animate();