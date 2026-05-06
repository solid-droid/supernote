console.log("Hello from Bun sidecar!");

// Simple echo loop
const reader = console[Symbol.asyncIterator]();
while (true) {
  const { value, done } = await reader.next();
  // if (done) break;
  console.log(`Bun received test: ${value}`);
}
