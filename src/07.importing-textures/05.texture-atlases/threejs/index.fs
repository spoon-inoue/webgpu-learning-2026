#version 300 es
precision highp float;

uniform sampler2D map;

in vec2 vTexCoord;
out vec4 outColor;

void main() {
  outColor = texture(map, vTexCoord);
}