<template>
  <div class="container mx-auto p-4">
    <h1>Welcome to the Snake Game!</h1>
    <p>Click the button to start the game.</p>
    <button @click="startGame">Start Game</button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'Home',
  setup() {
    const gameStarted = ref(false);

    const startGame = () => {
      gameStarted.value = true;
    };

    return {
      gameStarted,
      startGame,
    };
  },
});
</script>