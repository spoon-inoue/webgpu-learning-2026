import path from 'path-browserify'
import { sections } from './sections'

const listEl = document.querySelector<HTMLElement>('ul.sections')!

for (const section of sections) {
  const itemEl = document.createElement('li')
  listEl.appendChild(itemEl)

  const titleEl = document.createElement('p')
  titleEl.classList.add('title')
  titleEl.innerText = section.title
  itemEl.appendChild(titleEl)

  for (const link of section.links) {
    const containerEl = document.createElement('div')
    containerEl.classList.add('link-container')
    itemEl.appendChild(containerEl)

    const a = document.createElement('a')
    a.href = path.join(import.meta.env.BASE_URL, link.href, '/')
    a.innerText = link.label
    containerEl.appendChild(a)

    if (link.hasWgu) {
      const separator = document.createElement('span')
      separator.classList.add('separator')
      containerEl.appendChild(separator)

      const a = document.createElement('a')
      a.href = path.join(import.meta.env.BASE_URL, link.href, 'wgu', '/')
      a.innerText = 'wgu'
      containerEl.appendChild(a)
    }

    if (link.hasThree) {
      const separator = document.createElement('span')
      separator.classList.add('separator')
      containerEl.appendChild(separator)

      const a = document.createElement('a')
      a.href = path.join(import.meta.env.BASE_URL, link.href, 'threejs', '/')
      a.innerText = 'threejs'
      containerEl.appendChild(a)
    }
  }
}

const f32 = new Float32Array(5) // 5要素分
const f32_1_2 = f32.subarray(0, 2)
const f32_3_5 = f32.subarray(2, 5)

f32_1_2.set([1, 2])
f32_3_5.set([3, 4, 5])

console.log(f32)
// 1, 2, 3, 4, 5
