import { validateWorkerMetadata, metadataStore } from '../metadataStore'
import { useUIStore } from '../../stores/uiStore'

// Ensure isolation by resetting UI error state after each test.
afterEach(() => {
  useUIStore.getState().setError(null)
})

describe('validateWorkerMetadata', () => {
  it('accepts valid metadata objects', () => {
    const msg = { title: 't', artist: 'a' }
    expect(validateWorkerMetadata(msg)).toEqual(msg)
  })

  it('rejects unexpected fields', () => {
    expect(() => validateWorkerMetadata({ foo: 'bar' } as any)).toThrow('Unexpected field: foo')
  })

  it('rejects invalid field types', () => {
    expect(() => validateWorkerMetadata({ duration: 'oops' } as any)).toThrow('Invalid type for duration')
  })
})

describe('metadataStore.storeMetadata', () => {
  it('propagates validation errors to the UI store', async () => {
    const file = new File([new Uint8Array()], 'test.mp3')
    await expect(
      metadataStore.storeMetadata(file, { foo: 'bar' } as any, new ArrayBuffer(8))
    ).rejects.toThrow('Unexpected field: foo')
    expect(useUIStore.getState().error).toContain('Unexpected field: foo')
  })
})
