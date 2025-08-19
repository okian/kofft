export async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []
  const items = dataTransfer.items

  const traverseEntry = async (entry: any): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file(resolve, reject)
      })
      files.push(file)
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const readEntries = (): Promise<any[]> =>
        new Promise((resolve, reject) => reader.readEntries(resolve, reject))

      let entries: any[]
      do {
        entries = await readEntries()
        await Promise.all(entries.map(traverseEntry))
      } while (entries.length > 0)
    }
  }

  if (items && items.length > 0) {
    const promises = Array.from(items).map(async (item) => {
      if (item.kind === 'file') {
        const entry = (item as any).webkitGetAsEntry?.()
        if (entry) {
          await traverseEntry(entry)
        } else {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
    })
    await Promise.all(promises)
  } else {
    const dtFiles = dataTransfer.files
    for (let i = 0; i < dtFiles.length; i++) {
      files.push(dtFiles[i])
    }
  }

  return files
}
