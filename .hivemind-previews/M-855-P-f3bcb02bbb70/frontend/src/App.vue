<template>
  <div class="container mx-auto p-4">
    <header>
      <nav>
        <ul>
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/game">Game</router-link></li>
          <li><router-link to="/leaderboard">Leaderboard</router-link></li>
        </ul>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'App',
});
</script>

<style scoped>
.container {
  max-width: 800px;
}
</style>