#version 300 es

in vec3 position;
in vec4 color;
in vec2 offset;
in vec2 scale;
in vec4 perVertexColor;

out vec4 vColor;

void main() {
  vColor = color * perVertexColor;
  gl_Position = vec4(position.xy * scale + offset, 0, 1);
}