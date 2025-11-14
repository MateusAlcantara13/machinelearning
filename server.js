const express = require("express");
const path = require("path");
const app = express();

// Servir tudo dentro da pasta "public"
app.use(express.static(path.join(__dirname, "public")));

// Servir a pasta de sons corretamente
app.use("/sounds", express.static(path.join(__dirname, "public/sounds")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});
