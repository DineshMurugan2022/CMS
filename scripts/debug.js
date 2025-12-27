try {
    console.log("Attempting to require server.js...");
    require('./server.js');
} catch (e) {
    console.error("CRITICAL ERROR CAUGHT:");
    console.error(e);
}
