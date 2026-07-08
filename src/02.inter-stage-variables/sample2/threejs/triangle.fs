#version 300 es
precision highp float;

out vec4 outColor;

void main() {
  vec4 red = vec4(1, 0, 0, 1);
  vec4 cyan = vec4(0, 1, 1, 1);

  ivec2 grid = ivec2(gl_FragCoord.xy) / 8;
  bool checker = (grid.x + grid.y) % 2 == 1;
  outColor = mix(red, cyan, vec4(checker));
}