export class GPU {
  static async request() {
    const adapter = await navigator.gpu?.requestAdapter()
    if (!adapter) throw Error('GPUAdapterの取得に失敗しました')

    const device = await adapter.requestDevice()
    if (!device) throw Error('GPUDeviceの取得に失敗しました')

    return new GPU(adapter, device)
  }

  public readonly presentationFormat: GPUTextureFormat

  private constructor(
    public readonly adapter: GPUAdapter,
    public readonly device: GPUDevice,
  ) {
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  }
}
