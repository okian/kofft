import { getFilesFromDataTransfer } from '../file'

describe('getFilesFromDataTransfer', () => {
  it('collects files from DataTransfer including directories', async () => {
    const file1 = new File(['file1'], 'song1.mp3', { type: 'audio/mpeg' })
    const file2 = new File(['file2'], 'song2.mp3', { type: 'audio/mpeg' })

    const fileEntry = {
      isFile: true,
      file: (cb: (f: File) => void) => cb(file2)
    }
    let readCalls = 0
    const dirEntry = {
      isDirectory: true,
      createReader: () => ({
        readEntries: (cb: (entries: any[]) => void) => {
          if (readCalls++ === 0) cb([fileEntry])
          else cb([])
        }
      })
    }

    const items = [
      {
        kind: 'file',
        getAsFile: () => file1,
        webkitGetAsEntry: () => undefined
      } as any,
      {
        kind: 'file',
        webkitGetAsEntry: () => dirEntry
      } as any
    ]

  const dataTransfer = { items } as DataTransfer

    const files = await getFilesFromDataTransfer(dataTransfer)
    expect(files).toHaveLength(2)
    expect(files).toEqual(expect.arrayContaining([file1, file2]))
  })

  it('falls back to dataTransfer.files when items missing', async () => {
    const file = new File(['data'], 'single.mp3', { type: 'audio/mpeg' })
    const dataTransfer = { items: null, files: [file] } as any
    const files = await getFilesFromDataTransfer(dataTransfer)
    expect(files).toHaveLength(1)
    expect(files[0]).toBe(file)
  })
})
