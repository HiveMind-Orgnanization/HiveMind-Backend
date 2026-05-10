<template>
  <div class="container mx-auto p-4">
    <h1>Game Board</h1>
    <div class="grid grid-cols-10 gap-2">
      <div v-for="(cell, index) in grid" :key