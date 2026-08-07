  struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
  };

  struct Uniforms {
    matrix: mat4x4f,
  };

  @group(0) @binding(0) var<uniform> uni: Uniforms;
  @group(0) @binding(1) var tex: texture_2d<f32>;
  @group(0) @binding(2) var smp: sampler;

  @vertex fn vs(@builtin(vertex_index) vNdx: u32) -> VSOutput {
    let positions = array(
      vec2f( 0,  0),
      vec2f( 1,  0),
      vec2f( 0,  1),
      vec2f( 0,  1),
      vec2f( 1,  0),
      vec2f( 1,  1),
    );
    let pos = positions[vNdx];
    return VSOutput(
      uni.matrix * vec4f(pos, 0, 1),
      pos,
    );
  }

  @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
    return textureSample(tex, smp, fsInput.texcoord);
  }