import path from 'path-browserify'
import html from './BackToIndex.html?raw'

const div = document.createElement('div')
div.innerHTML = html

const link = div.children[0] as HTMLAnchorElement
link.href = path.join(import.meta.env.BASE_URL, '/')

const style = div.children[1] as HTMLStyleElement

document.body.append(link, style)
