#version 300 es
precision highp float;

uniform sampler2D dataMap;

in vec2 vUv;
out vec4 outColor;

void main() {
  float d = texture(dataMap, vUv).r;
  d *= 2.;
  outColor.r = d;
}