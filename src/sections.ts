export const sections: { title: string; links: { href: string; label: string; hasWgu?: boolean; hasThree?: boolean }[] }[] = [
  {
    title: 'WebGPUの基本',
    links: [
      { href: '/01.fundamentals/1.a-drawing-triangles-to-textures', label: '三角形をテクスチャに描く', hasThree: true },
      { href: '/01.fundamentals/2.a-run-computations-on-the-gpu', label: 'GPU上で計算を実行する', hasThree: true },
    ],
  },
  {
    title: 'inter-stage(シェーダ間)変数',
    links: [
      { href: '/02.inter-stage-variables/sample1', label: 'RGBカラー', hasThree: true },
      { href: '/02.inter-stage-variables/sample2', label: '市松模様', hasThree: true },
    ],
  },
  {
    title: 'ユニフォーム',
    links: [
      { href: '/03.uniforms/sample1', label: '三角形:1つ', hasWgu: true, hasThree: true },
      { href: '/03.uniforms/sample2', label: '三角形:多数', hasWgu: true, hasThree: true },
      { href: '/03.uniforms/sample3', label: '三角形:多数2', hasWgu: true, hasThree: true },
    ],
  },
  {
    title: 'ストレージバッファ',
    links: [
      { href: '/04.storage-buffers/01.basic', label: 'strogeへの置換', hasWgu: true, hasThree: true },
      { href: '/04.storage-buffers/02.instancing', label: 'インスタンス化', hasWgu: true, hasThree: true },
      { href: '/04.storage-buffers/03.vertex-data-with-storage', label: '頂点データのStorage化', hasWgu: true, hasThree: true },
    ],
  },
  {
    title: '透視投影',
    links: [
      { href: '/50.perspective-projection/01.divideZ', label: 'Zで割る', hasWgu: true, hasThree: true },
      { href: '/50.perspective-projection/02.matrix', label: 'Matrixに統合する', hasWgu: true, hasThree: true },
      { href: '/50.perspective-projection/03.perspective', label: '透視投影', hasWgu: true, hasThree: true },
    ],
  },
]
