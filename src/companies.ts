export interface Company {
  id: string
  name: string
  logo?: string
}

export const builtInCompanies: readonly Company[] = [
  { id: 'yandex', name: 'Яндекс', logo: './companies/yandex.png' },
  { id: 'ozon', name: 'Ozon', logo: './companies/ozon.png' },
  { id: 'avito', name: 'Авито', logo: './companies/avito.png' },
  { id: 'vk', name: 'VK', logo: './companies/vk.png' },
  { id: 'tbank', name: 'Т-Банк', logo: './companies/tbank.png' },
  { id: 'sber', name: 'Сбер', logo: './companies/sber.png' },
]

export const companyNameLimit = 80

export function readCustomCompanies(value: unknown): Company[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: Partial<Company> | null) => {
    if (typeof item?.id !== 'string' || !item.id.startsWith('custom-')
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > companyNameLimit) return []
    const logo = typeof item.logo === 'string' && item.logo.length <= 80_000
      && /^data:image\/(webp|png);base64,[A-Za-z0-9+/]+=*$/.test(item.logo) ? item.logo : undefined
    return [{ id: item.id, name: item.name.trim(), logo }]
  })
}

export async function prepareCompanyLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Выберите изображение в формате PNG, JPG или WebP.')
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Выберите файл размером до 5 МБ.')

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const size = 96
      const scale = Math.min(size / bitmap.width, size / bitmap.height, 1)
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable')
      context.drawImage(bitmap, 0, 0, width, height)
      return canvas.toDataURL('image/webp', 0.9)
    } finally {
      bitmap.close()
    }
  } catch {
    throw new Error('Не удалось открыть изображение. Выберите другой файл.')
  }
}
