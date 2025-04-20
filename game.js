// Simple Phaser Egg Hunt Game
class EggHuntGame extends Phaser.Scene {
  constructor() {
    super({ key: 'EggHuntGame' });

    this.eggWidth = 100;
    this.eggHeight = 100;

    this.eggGridSizeWidth = 40;
    this.eggGridSizeHeight = 40;

    this.numEggs = this.eggGridSizeWidth * this.eggGridSizeHeight; // Start with fewer eggs for testing

    this.worldSizeWidth = this.eggGridSizeWidth * this.eggWidth; // Size of the scrollable area
    this.worldSizeHeight = this.eggGridSizeHeight * this.eggHeight; // Size of the scrollable area

    this.winningEggIndex = 6;//Math.floor(Math.random() * (this.numEggs - 40)) + 20;
  }

  preload() {
    console.log("Preloading assets...");
    // Show loading progress
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(240, 270, 320, 50);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px Arial',
      fill: '#ffffff'
    });
    loadingText.setOrigin(0.5, 0.5);

    // Loading progress events
    this.load.on('progress', function (value) {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(250, 280, 300 * value, 30);
    });

    this.load.on('complete', function () {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    
    // Load the egg manifest
    this.load.json('game-manifest', 'game-manifest.json');

    // Log preload complete
    this.load.on('complete', () => {
      console.log("Initial preload complete");
      this.initialPreloadComplete = true;
    });
  }

  // Add this method to your class
  initializeSounds() {
    console.log("Initializing sounds from keys:", this.audioKeys);
    this.sounds = {};

    // Create sound objects for each loaded audio key
    if (this.audioKeys && this.audioKeys.length > 0) {
      this.audioKeys.forEach(key => {
        try {
          this.sounds[key] = this.sound.add(key);
          console.log(`Sound ${key} initialized successfully`);
        } catch (error) {
          console.error(`Error initializing sound ${key}:`, error);
        }
      });
    }
  }

  loadAssets(manifestName) {
    // process the manifest if available
    if (this.cache.json.has(manifestName)) {
      const manifest = this.cache.json.get(manifestName);
      console.log("Manifest loaded:", manifest);

      // debug log to help diagnose path issues
      console.log("Current document location:", window.location.href);

      // process image data from manifest and load any additional images
      if (manifest && manifest.images && manifest.images.length > 0) {
        // start a second loading phase for the eggs
        let loadingStarted = false;

        manifest.images.forEach(image => {
          // Create a more reliable path
          // We'll check if the path exists directly, or needs to be adjusted
          let path = image.path;

          // If you're having issues with relative paths, try one of these approaches:
          // Option 1: Use absolute path with CDN as fallback
          if (!path.startsWith('http')) {
            // try to load directly first, if that fails use the default images
            //console.log(`Loading image: ${image.id} from ${path}`);
            if (image.type == 'audio') {
              this.load.audio(image.id, path);
              this.audioKeys.push(image.id);
            } else {
              this.load.image(image.id, path);
              loadingStarted = true;
              if (image.type == 'egg') this.eggTextureKeys.push(image.id);
              if (image.type == 'env') this.envTextureKeys.push(image.id);
              if (image.type == 'fg') this.fgTextureKeys.push(image.id);
            }
          }
        });

        // if we added images to load, start the loader
        if (loadingStarted) {
          console.log("Starting secondary image loading");

          // set up a callback for when loading completes
          this.load.once('complete', this.onAssetsLoaded, this);

          // start loading the images
          this.load.start();
          return; // exit here - continue once images are loaded
        }
      }
    } else {
      console.warn(`${manifestName} manifest not found, using default eggs`);
    }
  }

  create() {
    console.log("Creating game elements...");

    // create an array to store all available texture keys
    this.eggTextureKeys = []; // start with default egg
    this.envTextureKeys = []; // start with default env
    this.fgTextureKeys = [];
    this.audioKeys = [];

    this.loadAssets('game-manifest');

    //this.sounds = {};
    //this.sounds['egg-pickup'] = this.sound.add('egg-pickup');
    //this.sounds['game-win'] = this.sound.add('game-win');
    // Object.keys(this.gameAssets.audio).forEach(key => {
    //   this.sounds[key] = this.sound.add(key);
    // });

    // If we reach here, we're using the default egg or didn't need secondary loading
    this.setupGameWorld();
  }

  // This gets called after the assets finish loading
  onAssetsLoaded() {
    console.log("Secondary assets load complete");
    console.log("Available egg textures:", this.eggTextureKeys);
    this.initializeSounds();
    this.setupGameWorld();
  }

  // Update your playSound method to use the sound objects
  playSound(soundName, randomPitch) {
    try {
      if (this.sounds && this.sounds[soundName]) {
        const soundPitch = randomPitch ? 0.8 + Math.random() * 0.4 : 1.0;

        // Play with the random pitch
        this.sounds[soundName].play({
          rate: soundPitch
        });
        console.log(`Playing sound: ${soundName} with pitch: ${soundPitch}`);
      } else {
        console.warn(`Sound ${soundName} not found in sounds collection`);
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  setupGameWorld() {
    console.log("Setting up game world with eggs...");
    // Create a simplex noise instance
    let noise;
    try {
      noise = new SimplexNoise();
    } catch (error) {
      console.error('SimplexNoise not available:', error);
      noise = {
        // Fallback if SimplexNoise isn't available
        noise2D: (x, y) => Math.random() * 2 - 1
      };
    }

    // Create a large scrollable world
    this.cameras.main.setBounds(0, 0, this.worldSizeWidth, this.worldSizeHeight);

    // Create egg group
    this.eggs = this.physics.add.group();

    let goldenEggPlaced = false;
    let idebug = 0;
    // populate the world with eggs
    for (let i = 0; i < this.eggGridSizeWidth * this.eggGridSizeHeight; i++) {
      // get x and y coordinate
      const x = (i % this.eggGridSizeWidth) * this.eggWidth;
      const y = Math.floor(i / this.eggGridSizeWidth) * this.eggHeight;

      // get noise value between -1 and 1
      let noise_value = noise.noise2D((x / this.eggGridSizeWidth) * 0.05, (y / this.eggGridSizeHeight) * 0.05);
      // clamp between 0 - 1
      noise_value = (noise_value + 1) * 0.5;
      // console.log(`noise: ${noise_value}`)
      // select env or egg based on noise value
      let textureKey;
      let index = Math.floor(noise_value * 5);
      textureKey = this.envTextureKeys[index];
      const sprite = this.add.sprite(x + this.eggWidth / 2, y + this.eggHeight / 2, textureKey);
      sprite.setScale(1);

      if (index < 3) {
          let index = Math.floor(Math.random() * (this.eggTextureKeys.length - 1));
          //index = this.clamp(index, 0, this.eggTextureKeys.length - 2);
          //let index = idebug % this.eggTextureKeys.length;//Math.floor(Math.random() * this.eggTextureKeys.length - 1);
          //console.log("index: " + this.eggTextureKeys[index]);
          //idebug++;
          textureKey = this.eggTextureKeys[index];
          
          if (i >= this.winningEggIndex && !goldenEggPlaced) {
            goldenEggPlaced = true;
            this.winningEggIndex = i;
            //textureKey = this.eggTextureKeys[this.eggTextureKeys.length-1];
            //console.log(`winning egg at ${i % this.eggGridSizeWidth} ${Math.floor(i / this.eggGridSizeWidth)}`);
          }
          // create egg sprite with the selected texture
          const egg = this.eggs.create(x + this.eggWidth / 2, y + this.eggHeight / 2, textureKey);

          // customize egg
          egg.setScale(1.15);
          egg.originalScale = egg.scale;
          egg.setInteractive();
          egg.index = i;
          egg.scaleRate = 300 + (Math.random() * 700);

          // handle egg clicks
          egg.on('pointerdown', () => {
            if (egg.index === this.winningEggIndex) {
              // found the winning egg!
              egg.setTexture(this.eggTextureKeys[this.eggTextureKeys.length-1]);
              this.showWinMessage();

              // play winning sound
              this.playSound('audio02', false);
            } else {
              // regular egg - make it disappear
              egg.setVisible(false);
              egg.disableInteractive();

              // play pickup sound
              this.playSound('audio01', true);
            }
          });
        //}
      }

      // foreground
      if (Math.random() < 0.4) {
        const fg_index = Math.floor(Math.random() * this.fgTextureKeys.length);
        textureKey = this.fgTextureKeys[fg_index];
        // create fg sprite with the selected texture
        const sprite = this.add.sprite(x + this.eggWidth / 2, y + this.eggHeight / 2, textureKey);
        sprite.setScale(1.2 + Math.random() * 0.5);
      }
    }


    // Improved camera controls (drag to scroll)
    this.cameras.main.setZoom(0.5);

    // Track drag state and starting position
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startScrollX = 0;
    this.startScrollY = 0;

    // Handle mouse/touch down
    this.input.on('pointerdown', (pointer) => {
      // Store start positions
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.startScrollX = this.cameras.main.scrollX;
      this.startScrollY = this.cameras.main.scrollY;
    });

    // Handle mouse/touch move
    this.input.on('pointermove', (pointer) => {
      if (this.isDragging) {
        // Calculate how far we've dragged
        const dragX = pointer.x - this.dragStartX;
        const dragY = pointer.y - this.dragStartY;

        // Set camera position based on the drag distance
        this.cameras.main.scrollX = this.startScrollX - dragX / this.cameras.main.zoom;
        this.cameras.main.scrollY = this.startScrollY - dragY / this.cameras.main.zoom;

        // Prevent default browser behavior
        if (pointer.event) {
          pointer.event.preventDefault();
          pointer.event.stopPropagation();
        }
      }
    });

    // Handle mouse/touch up
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('pointerout', () => {
      this.isDragging = false;
    });

    // add instructions
    const instructions = this.add.text(0, 0, 'Find the special egg!\nClick eggs to pickup.\nDrag to move around.', {
      fontSize: '30px',
      fontFamily: 'Arial, sans-serif',
      color: '#000000',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      align: 'center',
      padding: { x: 10, y: 10 },
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: 'rgba(0, 0, 0, 0.5)',
        blur: 2,
        fill: true
      }
    });
    instructions.setOrigin(1, 1);
    instructions.setScrollFactor(0);
    instructions.setDepth(100);

    // Position it in the bottom right corner of the camera viewport
    instructions.setPosition(
      this.cameras.main.width + 700,
      this.cameras.main.height + 300
    );

    // Keep the text in the right position when the window is resized
    // this.scale.on('resize', (gameSize) => {
    //   instructions.setPosition(
    //     gameSize.width - 20,
    //     gameSize.height - 20
    //   );
    // });
      
  }

  update(time, delta) {
    // Safety check - make sure eggs group exists
    if (!this.eggs) return;

    // Get all children but with safety check
    const children = this.eggs.getChildren();
    if (!children || children.length === 0) return;

    // Only update visible eggs and include error handling
    children.forEach(egg => {
      try {
        if (egg && egg.visible) {
          // Make sure originalScale exists
          if (egg.originalScale === undefined) {
            egg.originalScale = egg.scale || 1;
          }
          let breathScale = 1 + Math.sin(time / egg.scaleRate) * 0.05;
          egg.setScale(egg.originalScale * breathScale);
        }
      } catch (e) {
        console.error("Error animating egg:", e);
      }
    });
  }

  showWinMessage() {
    // Add a background to make sure text is visible
    const textBg = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      800,
      200,
      0x000000,
      0.5
    );
    textBg.setOrigin(0.5);
    textBg.setScrollFactor(0);
    textBg.setDepth(1);

    const winText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      `YOU FOUND THE GOLDEN EGG!\nTAKE A PICTURE AND\nSUBMIT TO TEAMS FOR A PRIZE!`,
      {
        fontSize: '48px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000',
          blur: 5,
          fill: true
        }
      }
    );
    winText.setOrigin(0.5);
    winText.setScrollFactor(0);
    winText.setDepth(2);
  }
}



// Game configuration
const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#00c947',
  parent: 'game-container',
  physics: {
    default: 'arcade'
  },
  input: {
    activePointers: 2,
    dragDistanceThreshold: 5  // Helps to detect drags vs. clicks more accurately
  },
  scene: [EggHuntGame]
};

// Create and start the game
const game = new Phaser.Game(config);

// Handle window resizing
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});