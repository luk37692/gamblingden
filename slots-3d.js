/**
 * 3D Slots Implementation
 * Handles the Three.js scene, reel creation, and spin animations.
 * Exposed globally as `Slots3D` for the main logic to control.
 */
const Slots3D = (function () {
  'use strict';

  let scene, camera, renderer;
  let reels = []; // Array of Mesh objects
  let symbolTexture; // The atlas texture
  const SYMBOL_COUNT = 6;
  const REEL_RADIUS = 3; 
  const SEGMENTS = 32;
  // Calculate angle per symbol: 6 symbols repeated X times around the cylinder?
  // Let's simpler: Cylinder has enough height or circumference to hold many symbols.
  // Actually, standard 3D slots often model strict strips.
  // We'll map the texture such that it repeats vertically.
  // If we have 6 symbols, let's say the cylinder circumference holds exactly 12 symbols (2 sets).
  const SYMBOLS_ON_REEL = 12; 
  const ANGLE_PER_SYMBOL = (Math.PI * 2) / SYMBOLS_ON_REEL;

  // Configuration from main logic (to be sync)
  const SYMBOLS_MAP = ["CHERRY", "LEMON", "BELL", "SEVEN", "WILD", "SCATTER"];
  
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161b27); // Match --bg-card

    // CAMERA
    // Use Orthographic to avoid perspective distortion on the edges (makes it look more like a classic flat slot but 3D)
    // Or Perspective for coolness. Let's go Perspective but with narrow FOV and far distance.
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 1000);
    camera.position.z = 22;
    camera.position.y = 0; 

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    const spotLight = new THREE.SpotLight(0x6366f1, 0.5); // --accent-primary
    spotLight.position.set(0, 10, 0);
    scene.add(spotLight);

    // TEXTURES
    symbolTexture = createSymbolAtlas();

    // REELS
    createReels();

    // Loop
    animate();

    // Trigger initial render
    renderer.render(scene, camera);

    // Resize
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
  }

  function createSymbolAtlas() {
    const size = 512; // Each symbol is 512x512
    const canvas = document.createElement('canvas');
    canvas.width = size * SYMBOL_COUNT; // Horizontal strip
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const emojis = ["🍒", "🍋", "🔔", "7️⃣", "⭐", "💎"];

    emojis.forEach((emoji, i) => {
        const x = i * size;
        
        // Background panel
        const gradient = ctx.createLinearGradient(x, 0, x, size); // Vertical gradient per cell
        gradient.addColorStop(0, '#f1f5f9');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 0, size, size);

        // Border line (Vertical lines between symbols)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + size - 2, 0, 4, size);

        // Symbol
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${size * 0.6}px serif`; 
        ctx.fillStyle = "#000";
        ctx.fillText(emoji, x + size / 2, size / 2 + (size * 0.05)); 
    });

    const tex = new THREE.CanvasTexture(canvas);
    // Horizontal wrapping
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function createReels() {
    // Cylinder: RadiusTop, RadiusBot, Height, RadialSegs, HeightSegs, OpenEnded
    // Rotated 90deg Z: Height (4) becomes Width (X axis).
    // Radial Segments wrap around the X axis.
    const geometry = new THREE.CylinderGeometry(REEL_RADIUS, REEL_RADIUS, 4, SEGMENTS, 1, true);
    geometry.rotateZ(Math.PI / 2); 
    
    // Texture is Horizontal: [Cherry][Lemon]...
    // Mapped to Cylinder Circumference (U).
    // We want 2 full sets of symbols around the reel.
    // So we repeat U 2 times.
    symbolTexture.repeat.set(2, 1); 
    
    // Adjust texture offset if needed to align symbol 0
    // symbolTexture.offset.x = ?

    const material = new THREE.MeshStandardMaterial({ 
        map: symbolTexture,
        roughness: 0.3,
        metalness: 0.2
    });

    for(let i=0; i<3; i++) {
        const reel = new THREE.Mesh(geometry, material.clone());
        reel.position.x = (i - 1) * 4.5; // Spread them out more: -4.5, 0, 4.5
        scene.add(reel);
        reels.push(reel);
        
        // Initial random rotation
        // 12 slots total (2 sets of 6).
        // Angle per slot = 2PI / 12 = PI / 6.
        const randomSlot = Math.floor(Math.random() * SYMBOLS_ON_REEL);
        reel.rotation.x = randomSlot * ANGLE_PER_SYMBOL;
        
        reel.userData = { isSpinning: false };
    }
  }

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPOSED API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Spin the reels to a specific stop index
   * @param {number[]} stops - Array of 3 indices (0-based index of the symbol strip)
   * The logic in slots.js uses simple arrays for reels.
   * We need to map "Stop Index from Logic" -> "Visual Symbol".
   * 
   * Logic Reel: ["CHERRY", "BELL", ...] (Length ~20-30)
   * Visual Reel: Just 12 slots on the cylinder, repeating the 6 basic symbols.
   * 
   * This is a "fake" visual representation. 
   * When logic says "Stop at index 5 (which is BELL)", we must rotate the 3D reel 
   * so that a "BELL" section is facing forward.
   */
  async function spinTo(stops, logicalReels) {
     const promises = reels.map((reel, index) => {
        return new Promise(resolve => {
            const targetSymbolName = logicalReels[index][stops[index]]; // e.g., "BELL"
            const symbolIndex = SYMBOLS_MAP.indexOf(targetSymbolName);
            
            // Calculate target angle
            // We have 12 slots. Symbols are 0..5, 0..5.
            // Let's pick a random instance of that symbol on the wheel to land on (either first or second half)
            const instance = Math.random() < 0.5 ? 0 : 1;
            const targetSlot = symbolIndex + (instance * 6);
            
            // We spin FORWARD (positive X rotation).
            // Current angle
            const current = reel.rotation.x;
            
            // Angle to land exactly on targetSlot
            // UV 0 is at theta 0? Need to calibrate.
            // Usually need a detailed offset. Let's assume 0 is aligned.
            const slotAngle = targetSlot * ANGLE_PER_SYMBOL;
            
            // We want to do at least 2 full spins + delta
            const fullSpins = (Math.PI * 2) * (3 + index); // 3, 4, 5 spins staggered
            
            // Calculate destination: Next multiple of 2PI that aligns with slotAngle
            // Or just current + spins + diff.
            
            // The texture is rotated, mapping is tricky.
            // Let's trial and error the offset if needed.
            // Assuming standard UV mapping: 0 radians = start of texture.
            
            // Destination angle
            // We subtract because cylinder rolls "towards" player? 
            // Identifying "Front": usually Z+.
            // If we rotate X, the top moves back, bottom moves front. 
            // We want symbols to fly down (Top -> Bottom).
            // That means X rotation should be POSITIVE? (Right Hand Rule: Thumb X+, fingers curl Y->Z).
            // Yes, Positive X rotation makes top go back? No, wait.
            // Thumb right. Fingers curl Top(Y) -> Front(Z) -> Bottom(-Y) -> Back(-Z).
            // So +X makes top come Forward. That's "Symbols falling down". Correct.
            
            const destAngle = current + fullSpins + ((slotAngle - (current % (Math.PI * 2))) % (Math.PI * 2));
            // Actually, simplified:
            // Just add spins + offset to reach the specific symbol orientation.
            // Since we don't know exact offset, we might need a "offset correction" constant.
            // Let's Assume 0 is correct for now.
            
            // TWEEN replacement (simple animation loop)
            const duration = 2000 + (index * 500);
            const startTime = performance.now();
            const startAngle = reel.rotation.x;
            // Ensure we land on exact slot multiple relative to total rotation
            // We want final angle to satisfy: (final % 2PI) approx (slotAngle)
            // But since texture repeats, we just need to match the visual.
            
            // Let's use a simple heuristic:
            // Add arbitrary large rotations, then add the specific delta to reach target.
            const rounds = 5 + index * 2;
            const targetRotation = startAngle + (rounds * Math.PI * 2) + (slotAngle - (startAngle % (Math.PI * 2)));

            function animateReel(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease Out Cubic
                const ease = 1 - Math.pow(1 - progress, 3);
                
                reel.rotation.x = startAngle + (targetRotation - startAngle) * ease;
                
                if (progress < 1) {
                    requestAnimationFrame(animateReel);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(animateReel);
        });
     });

     await Promise.all(promises);
  }
  
  return {
    init,
    spinTo
  };

})();
