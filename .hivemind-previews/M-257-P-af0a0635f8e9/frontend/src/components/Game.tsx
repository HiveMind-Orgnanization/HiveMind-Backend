import React, { useEffect, useRef, useState } from 'react';

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;

    // Game variables
    let snake = [{ x: 10, y: 10 }];
    let food = { x: 15, y: 15 };
    let dx = 1;
    let dy = 0;

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'black';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Draw snake
      context.fillStyle = 'lime';
      snake.forEach(part => {
        context.fillRect(part.x * 10, part.y * 10, 10, 10);
      });

      // Draw food
      context.fillStyle = 'red';
      context.fillRect(food.x * 10, food.y * 10, 10, 10);
    };

    const update = () => {
      const head = { x: snake[0].x + dx, y: snake[0].y + dy };
      snake.unshift(head);

      // Check for food collision
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 1);
        food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
      } else {
        snake.pop();
      }

      // Check for collisions
      if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || snake.slice(1).some(part => part.x === head.x && part.y === head.y)) {
        setGameOver(true);
      }
    };

    const gameLoop = () => {
      if (!gameOver) {
        draw();
        update();
        setTimeout(gameLoop, 100);
      }
    };

    gameLoop();

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          dy = -1;
          dx = 0;
          break;
        case 'ArrowDown':
          dy = 1;
          dx = 0;
          break;
        case 'ArrowLeft':
          dx = -1;
          dy = 0;
          break;
        case 'ArrowRight':
          dx = 1;
          dy = 0;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameOver]);

  const restartGame = () => {
    setScore(0);
    setGameOver(false);
  };

  return (
    <div>
      <canvas ref={canvasRef} width={200} height={200} />
      <h2>Score: {score}</h2>
      {gameOver && <div><h2>Game Over</h2><button onClick={restartGame}>Restart</button></div>}
    </div>
  );
};

export default Game;
