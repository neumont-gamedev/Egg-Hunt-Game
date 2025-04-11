// Simple Phaser Egg Hunt Game
class EggHuntGame extends Phaser.Scene {
    constructor() {
      super({ key: 'EggHuntGame' });
      this.numEggs = 100; // Start with fewer eggs for testing
      this.worldSize = 2000; // Size of the scrollable area
      this.winningEggIndex = Math.floor(Math.random() * this.numEggs);
    }
  
    preload() {
      // Load a simple egg image (you can replace with your own later)
      this.load.image('egg', 'https://examples.phaser.io/assets/sprites/mushroom.png');
      this.load.image('winning-egg', 'https://examples.phaser.io/assets/sprites/phaser-dude.png');
    }
  
    create() {
      // Create a large scrollable world
      this.cameras.main.setBounds(0, 0, this.worldSize, this.worldSize);
      
      // Create egg group
      this.eggs = this.physics.add.group();
      
      // Populate the world with eggs
      for (let i = 0; i < this.numEggs; i++) {
        const x = Math.random() * this.worldSize;
        const y = Math.random() * this.worldSize;
        
        // Create egg sprite
        const egg = this.eggs.create(x, y, 'egg');
        egg.setInteractive();
        egg.index = i;
        
        // Handle egg clicks
        egg.on('pointerdown', () => {
          if (egg.index === this.winningEggIndex) {
            // Player found the winning egg!
            egg.setTexture('winning-egg');
            this.showWinMessage();
          } else {
            // Regular egg - make it disappear
            egg.setVisible(false);
            egg.disableInteractive();
          }
        });
      }
      
      // Add camera controls (drag to scroll)
      this.cameras.main.setZoom(0.8);
      this.input.on('pointermove', (pointer) => {
        if (pointer.isDown) {
          this.cameras.main.scrollX -= pointer.velocity.x / 10;
          this.cameras.main.scrollY -= pointer.velocity.y / 10;
        }
      });
      
      // Add simple instructions
      const instructions = this.add.text(10, 10, 'Find the special egg!\nClick eggs to reveal.\nDrag to move around.', {
        fontSize: '18px',
        backgroundColor: '#fff',
        padding: { x: 10, y: 5 }
      });
      instructions.setScrollFactor(0);
    }
    
    showWinMessage() {
      const winText = this.add.text(
        this.cameras.main.centerX, 
        this.cameras.main.centerY, 
        'YOU FOUND IT!', 
        { fontSize: '64px', color: '#ff0' }
      );
      winText.setOrigin(0.5);
      winText.setScrollFactor(0);
    }
  }
  
  // Game configuration
  const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    physics: {
      default: 'arcade'
    },
    scene: [EggHuntGame]
  };
  
  // Create and start the game
  const game = new Phaser.Game(config);
  
  // Handle window resizing
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });