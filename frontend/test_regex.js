const { JSDOM } = require("jsdom");

const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
const document = dom.window.document;

const span = document.createElement("span");
span.textContent = "{{customer.name}}";

const div = document.createElement("div");
div.appendChild(span);

let html = div.innerHTML;
console.log("Original HTML:", html);

const previewData = {
    'customer.name': 'Acme Corporation'
};

let rendered = html;
Object.entries(previewData).forEach(([key, value]) => {
    // Escape dot in key to ensure it isn't causing weird issues, though it shouldn't
    const safeKey = key.replace(/\./g, '\\.');
    rendered = rendered.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, 'g'), value);
});

console.log("Rendered HTML:", rendered);
