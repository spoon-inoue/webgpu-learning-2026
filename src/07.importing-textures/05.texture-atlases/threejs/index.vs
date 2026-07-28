#version 300 es

in vec3 position;
in vec2 texcoord;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

out vec2 vTexCoord;

void main() {
  vTexCoord = texcoord;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1);
}