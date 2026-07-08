export const sections: { title: string; links: { href: string; label: string; hasThree?: boolean }[] }[] = [
  {
    title: 'WebGPUの基本',
    links: [
      { href: '/01.fundamentals/1.a-drawing-triangles-to-textures', label: '三角形をテクスチャに描く', hasThree: true },
      { href: '/01.fundamentals/2.a-run-computations-on-the-gpu', label: 'GPU上で計算を実行する', hasThree: true },
    ],
  },
  {
    title: 'inter-stage(シェーダ間)変数',
    links: [{ href: '/02.inter-stage-variables', label: 'index' }],
  },
]
