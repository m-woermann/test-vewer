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
const instancedOriginalMatrices = new Map(); // Map(instancedMesh.uuid -> Array of Matrix4)

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
// This keeps the light effectively 'attached' to the camera while still illuminating the scene ahead.
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

                // Track instanced mesh for interaction and keep original matrices
                instancedMeshes.push(inst);
                instancedBaseScale.set(inst.uuid, child.scale.clone());
                selectedInstances.set(inst.uuid, new Set());
                instancedOriginalMatrices.set(inst.uuid, originalMatrices);
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



// Pointer/click handling for instanced meshes
// Selection mode: if true, selecting a new instance will revert other selections.
// If false, clicks toggle only the clicked instance (multi-toggle mode).
const singleSelect = false; // change to true for single-select behavior

// Debug marker to visualize where the selected instance should be
const debugMarkerGeometry = new THREE.SphereGeometry(30, 12, 12); // larger so it's easier to see
const debugMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
debugMarkerMaterial.depthTest = false; // render on top
const debugMarker = new THREE.Mesh(debugMarkerGeometry, debugMarkerMaterial);
debugMarker.visible = false;
debugMarker.renderOrder = 999;
scene.add(debugMarker);

function getInstanceWorldPosition(inst, instanceId, targetVec = new THREE.Vector3()) {
    const mat = new THREE.Matrix4();
    inst.getMatrixAt(instanceId, mat);
    mat.decompose(targetVec, new THREE.Quaternion(), new THREE.Vector3());
    // The instanced mesh may be transformed by its own world matrix; apply it
    inst.updateMatrixWorld();
    inst.localToWorld(targetVec);
    return targetVec;
}
function revertAllSelectedInstances() {
    // Revert all selected instances across all instanced meshes to their original matrices
    for (const otherInst of instancedMeshes) {
        const otherSelectedSet = selectedInstances.get(otherInst.uuid);
        if (!otherSelectedSet || otherSelectedSet.size === 0) continue;
        const originals = instancedOriginalMatrices.get(otherInst.uuid);
        for (const selId of Array.from(otherSelectedSet)) {
            if (originals && originals[selId]) {
                otherInst.setMatrixAt(selId, originals[selId]);
            }
            otherSelectedSet.delete(selId);
        }
        otherInst.instanceMatrix.needsUpdate = true;
    }
}

function selectInstance(inst, instanceId) {
    const selectedSet = selectedInstances.get(inst.uuid);
    if (!selectedSet) return;
    const matrix = new THREE.Matrix4();
    inst.getMatrixAt(instanceId, matrix);
    const dummy = new THREE.Object3D();
    dummy.matrix.copy(matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    // Move selected instance toward the camera in world space so movement is visible regardless of local axes
    const toCamera = new THREE.Vector3().subVectors(camera.position, dummy.position).setY(0).normalize();
    const moveAmount = 80;
    console.log('[selectInstance] before pos', dummy.position.toArray());
    dummy.position.addScaledVector(toCamera, moveAmount);
    console.log('[selectInstance] after pos', dummy.position.toArray());

    // write back matrix (clone to be safe)
    dummy.updateMatrix();
    inst.setMatrixAt(instanceId, dummy.matrix.clone());
    selectedSet.add(instanceId);
    inst.instanceMatrix.needsUpdate = true;
    // place debug marker at expected world position and log actual world position read-back
    const worldPos = getInstanceWorldPosition(inst, instanceId, new THREE.Vector3());
    debugMarker.position.copy(worldPos);
    debugMarker.visible = true;
    console.log('[selectInstance] worldPos after set:', worldPos.toArray());
}

function deselectInstance(inst, instanceId) {
    const selectedSet = selectedInstances.get(inst.uuid);
    if (!selectedSet) return;
    const originals = instancedOriginalMatrices.get(inst.uuid);
    if (originals && originals[instanceId]) {
        inst.setMatrixAt(instanceId, originals[instanceId].clone());
    } else {
        // fallback: nudge back toward original direction by moving away from camera
        const matrix = new THREE.Matrix4();
        inst.getMatrixAt(instanceId, matrix);
        const dummy = new THREE.Object3D();
        dummy.matrix.copy(matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        const awayFromCamera = new THREE.Vector3().subVectors(dummy.position, camera.position).setY(0).normalize();
        dummy.position.addScaledVector(awayFromCamera, 80);
        dummy.updateMatrix();
        inst.setMatrixAt(instanceId, dummy.matrix.clone());
    }
    selectedSet.delete(instanceId);
    inst.instanceMatrix.needsUpdate = true;
    // update debug marker position to the restored position and log
    const worldPos = getInstanceWorldPosition(inst, instanceId, new THREE.Vector3());
    debugMarker.position.copy(worldPos);
    console.log('[deselectInstance] worldPos after restore:', worldPos.toArray());
    // hide the marker if no selections remain
    let anySelected = false;
    for (const s of selectedInstances.values()) if (s.size > 0) anySelected = true;
    debugMarker.visible = anySelected;
}

function onPointer(event) {
    // Calculate normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Debug logging to diagnose click issues
    console.log('[onPointer] client:', event.clientX, event.clientY, 'rect:', rect.left, rect.top, rect.width, rect.height);
    console.log('[onPointer] ndc:', pointer.x.toFixed(2), pointer.y.toFixed(2), 'instancedMeshes:', instancedMeshes.length);

    raycaster.setFromCamera(pointer, camera);

    // Raycast against all instanced meshes and collect closest hit
    let closest = null;
    for (const inst of instancedMeshes) {
        const hits = raycaster.intersectObject(inst);
        if (hits && hits.length) {
            for (const h of hits) {
                if (!closest || h.distance < closest.hit.distance) {
                    closest = { hit: h, inst };
                }
            }
        }
    }

    if (!closest) {
        console.log('[onPointer] no hit');
        return;
    }

    const { hit, inst } = closest;
    const instanceId = hit.instanceId;
    if (instanceId === undefined || instanceId === null) return;

    const selectedSet = selectedInstances.get(inst.uuid) || new Set();
    const isSelected = selectedSet.has(instanceId);

    if (singleSelect) {
        if (!isSelected) {
            // selecting a new instance -> revert all other selections first
            console.log('[onPointer] selecting', instanceId, 'on', inst.uuid);
            revertAllSelectedInstances();
            selectInstance(inst, instanceId);
            console.log('Selected instance', instanceId, 'of', inst.uuid);
        } else {
            console.log('[onPointer] deselecting', instanceId, 'on', inst.uuid);
            // clicked an already-selected instance -> deselect it
            deselectInstance(inst, instanceId);
            console.log('Deselected instance', instanceId, 'of', inst.uuid);
        }
    } else {
        // toggle-only behavior: clicking toggles this instance without affecting others
        if (!isSelected) {
            console.log('[onPointer] toggle-select', instanceId, 'on', inst.uuid);
            selectInstance(inst, instanceId);
        } else {
            console.log('[onPointer] toggle-deselect', instanceId, 'on', inst.uuid);
            deselectInstance(inst, instanceId);
        }
    }
}

// Ensure there is a click fallback in case pointer events aren't reaching the canvas
canvas.addEventListener('click', (e) => {
    // If pointer events are used this will duplicate, but logs help debugging
    onPointer(e);
});



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
        // apply damping to velocity
        // exponential decay
        panVelocity = panVelocity * Math.exp(-panDamping * delta);
        // cut tiny velocities
        if (Math.abs(panVelocity) < 1e-3) panVelocity = 0;
    }
    // Recompute the cameraTarget so the camera keeps the configured pitch while allowing horizontal pans.
    // We compute a forward vector from the camera orientation, then build a target some distance ahead
    // but enforce the vertical angle using cameraPitchRad.
    const forwardNow = new THREE.Vector3();
    camera.getWorldDirection(forwardNow);
    // Keep horizontal direction from current forward, but override vertical component from pitch
    const horizontalDir = new THREE.Vector3(forwardNow.x, 0, forwardNow.z).normalize();
    // Build a new forward that has the desired vertical pitch but uses current horizontal heading
    const pitchedDir = new THREE.Vector3();
    pitchedDir.copy(horizontalDir);
    // vertical component = -sin(pitch) (negative because camera looks down for positive pitch)
    pitchedDir.y = -Math.sin(cameraPitchRad);
    // normalize so the forward length is 1, then scale to a comfortable look distance
    pitchedDir.normalize();
    const lookDistance = 2000; // how far ahead the camera should look; tweak if needed
    cameraTarget.copy(camera.position).addScaledVector(pitchedDir, lookDistance);
    camera.lookAt(cameraTarget);
    // Position the spotlight relative to the camera and keep the target synced with camera target
    spotLight.position.copy(camera.position).add(lightOffset);
    targets1.position.copy(cameraTarget);
    // keep the SpotLightHelper in sync with the light/target movement
    helper.update();
    renderer.render(scene, camera);
};
animate();