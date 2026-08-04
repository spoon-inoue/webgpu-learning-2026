#version 300 es
precision highp float;

uniform samplerCube map;

in vec3 vNormal;
out vec4 outColor;

void main() {
  outColor = texture(map, normalize(vNormal));
}