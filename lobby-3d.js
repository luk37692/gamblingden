/**
 * 3D Lobby Background using Three.js
 */
(function () {
  'use strict';

  const container = document.querySelector('.hero-particles');
  if (!container) return;

  // Clear existing content (CSS particles)
  container.innerHTML = '';

  // Scene Setup
  const scene = new THREE.Scene();
  // Add some fog for depth
  scene.fog = new THREE.FogExp2(0x111111, 0.05);

  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 15;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (e) {
    console.warn('WebGL not supported, falling back to simple canvas or disabling 3D');
    // Fallback: Just return or show an error, or use a 2D canvas fallback.
    // For now we will return to prevent cascading errors.
    container.innerHTML = '<div style="width:100%;height:100%;background:radial-gradient(ellipse at center, rgba(99,102,241,0.2) 0%, rgba(0,0,0,0) 70%);"></div>';
    return;
  }

  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  pointLight.position.set(10, 10, 10);
  scene.add(pointLight);

  // Texture Generation Helpers
  const textureCache = {};

  function createCanvasTexture(key, drawFn, size = 128) {
    if (textureCache[key]) return textureCache[key];

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, size);
    
    const texture = new THREE.CanvasTexture(canvas);
    textureCache[key] = texture;
    return texture;
  }

  function drawDiceFace(ctx, size, number, bgColor, dotColor) {
    // Fill surface
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    
    // Border for definition
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = size * 0.04;
    ctx.strokeRect(0, 0, size, size);

    // Dots
    ctx.fillStyle = dotColor;
    const r = size * 0.1;
    const c = size / 2;
    const q1 = size / 4;
    const q3 = size * 3 / 4;

    const positions = {
      1: [[c, c]],
      2: [[q1, q1], [q3, q3]],
      3: [[q1, q1], [c, c], [q3, q3]],
      4: [[q1, q1], [q1, q3], [q3, q1], [q3, q3]],
      5: [[q1, q1], [q1, q3], [c, c], [q3, q1], [q3, q3]],
      6: [[q1, q1], [q1, c], [q1, q3], [q3, q1], [q3, c], [q3, q3]]
    };
    
    (positions[number] || []).forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawChipFace(ctx, size, colorHex) {
     const c = size / 2;
     const color = '#' + new THREE.Color(colorHex).getHexString();
     
     // Main body
     ctx.fillStyle = color;
     ctx.beginPath();
     ctx.arc(c, c, c, 0, Math.PI * 2);
     ctx.fill();
     
     // Dashed Ring
     ctx.strokeStyle = '#ffffff';
     ctx.lineWidth = size * 0.15;
     ctx.setLineDash([size * 0.15, size * 0.15]);
     ctx.beginPath();
     ctx.arc(c, c, c * 0.7, 0, Math.PI * 2);
     ctx.stroke();

     // Inner circle
     ctx.fillStyle = '#ffffff';
     ctx.setLineDash([]);
     ctx.beginPath();
     ctx.arc(c, c, c * 0.45, 0, Math.PI * 2);
     ctx.fill();

     // Text
     ctx.fillStyle = '#333';
     ctx.font = `bold ${size * 0.4}px "Arial Black"`;
     ctx.textAlign = "center";
     ctx.textBaseline = "middle";
     ctx.fillText("$", c, c * 1.05);
  }

  // Objects
  const objects = [];
  
  // Geometries
  const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const chipGeo = new THREE.CylinderGeometry(1, 1, 0.2, 32);

  function createObject() {
    let mesh;
    const type = Math.random();

    if (type < 0.4) {
        // --- DICE ---
        // Red dice, white dots
        const materials = [];
        for(let i=1; i<=6; i++) {
            const tex = createCanvasTexture(`die-red-${i}`, (ctx, s) => drawDiceFace(ctx, s, i, '#e53935', '#ffffff'));
            materials.push(new THREE.MeshPhongMaterial({ map: tex, shininess: 50 }));
        }
        mesh = new THREE.Mesh(boxGeo, materials);

    } else if (type < 0.8) {
        // --- CHIP ---
        const colors = [0x43a047, 0x1e88e5, 0x3949ab, 0xef5350]; // Green, Blue, Indigo, Red
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Top/Bottom texture
        const faceTex = createCanvasTexture(`chip-${color}`, (ctx, s) => drawChipFace(ctx, s, color));
        
        // Side texture (striped)
        const sideTex = createCanvasTexture(`chip-side`, (ctx, s) => {
            const c = '#' + new THREE.Color(0xFFFFFF).getHexString();
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, s, s);
            ctx.fillStyle = '#ddd';
            for(let i=0; i<4; i++) ctx.fillRect(0, i*(s/4), s, 4);
        });

        const matFace = new THREE.MeshPhongMaterial({ map: faceTex });
        const matSide = new THREE.MeshPhongMaterial({ map: sideTex, color: color });
        
        // Cylinder materials: [side, top, bottom]
        mesh = new THREE.Mesh(chipGeo, [matSide, matFace, matFace]);
        
        // Orient chip to face camera/float flat initially
        mesh.rotation.x = Math.PI / 2;

    } else {
        // --- GEM/OTHER (Keep random colored shapes for variety) ---
        const geo = new THREE.IcosahedronGeometry(0.8);
        const mat = new THREE.MeshPhongMaterial({ 
            color: Math.random() < 0.5 ? 0xffd700 : 0xab47bc, // Gold or Purple 
            shininess: 100, 
            flatShading: true 
        });
        mesh = new THREE.Mesh(geo, mat);
    }
    
    // Position & Rotation
    mesh.position.x = (Math.random() - 0.5) * 40;
    mesh.position.y = (Math.random() - 0.5) * 25;
    mesh.position.z = (Math.random() - 0.5) * 15;
    
    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI;

    // Physics/Movement Data
    mesh.userData = {
        rotX: (Math.random() - 0.5) * 0.02,
        rotY: (Math.random() - 0.5) * 0.02,
        velY: (Math.random() - 0.5) * 0.015
    };

    scene.add(mesh);
    objects.push(mesh);
  }

  // Create initial objects
  for (let i = 0; i < 25; i++) {
    createObject();
  }

  // Mouse Interaction
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Camera sway based on mouse
    camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
    camera.position.y += (mouseY * 5 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    // Animate objects
    objects.forEach(obj => {
        obj.rotation.x += obj.userData.rotX;
        obj.rotation.y += obj.userData.rotY;
        obj.position.y += obj.userData.velY;

        // Floating boundary check
        if (Math.abs(obj.position.y) > 10) {
            obj.userData.velY *= -1;
        }
    });

    renderer.render(scene, camera);
  }

  animate();

  // Handle Resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

})();
