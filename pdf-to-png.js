/**
 * PDF页面转PNG图片工具
 * 用于将原理图PDF转换为可分析的图片格式
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

function convertPdfToImage() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
PDF转PNG工具

用法:
  node pdf-to-png.js <PDF路径> <页码> [输出文件名]

参数:
  PDF路径      - 输入PDF文件路径
  页码         - 要转换的页码（从1开始）
  输出文件名   - 可选，默认为: page_<页码>.png

示例:
  node pdf-to-png.js ./Database/YT8522_REF_Schematic.pdf 2
  node pdf-to-png.js ./Database/YT8522_REF_Schematic.pdf 2 schematic_main.png

说明:
  此工具需要系统安装以下任一工具:
  - pdftoppm (推荐，Linux/Mac自带，Windows需安装 poppler-utils)
  - ImageMagick的convert命令
  - 或使用在线工具: https://www.ilovepdf.com/pdf_to_image

如果上述工具都没有，请手动操作:
  1. 打开PDF文件
  2. 导航到目标页面
  3. 截图或"另存为图片"
  4. 保存为PNG格式
    `)
    process.exit(0)
  }

  const pdfPath = args[0]
  const pageNum = parseInt(args[1])
  const outputName = args[2] || `page_${pageNum}.png`

  if (!fs.existsSync(pdfPath)) {
    console.error(`错误: PDF文件不存在: ${pdfPath}`)
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('PDF转PNG工具')
  console.log('='.repeat(60))
  console.log(`输入: ${pdfPath}`)
  console.log(`页码: ${pageNum}`)
  console.log(`输出: ${outputName}`)
  console.log('='.repeat(60))

  // 尝试使用pdftoppm
  try {
    console.log('\n尝试使用 pdftoppm...')
    const command = `pdftoppm -png -f ${pageNum} -l ${pageNum} -r 300 "${pdfPath}" page_temp`
    execSync(command)

    // 重命名生成的文件
    const tempFile = `page_temp-${pageNum}.png`
    if (fs.existsSync(tempFile)) {
      fs.renameSync(tempFile, outputName)
      console.log(`✓ 成功! 已保存到: ${outputName}`)
      console.log(`\n现在可以运行:`)
      console.log(`  npm run test-schematic-img ${outputName} analysis`)
      process.exit(0)
    }
  } catch (error) {
    console.log('  pdftoppm 不可用')
  }

  // 尝试使用ImageMagick
  try {
    console.log('\n尝试使用 ImageMagick convert...')
    const command = `convert -density 300 "${pdfPath}[${pageNum - 1}]" "${outputName}"`
    execSync(command)

    if (fs.existsSync(outputName)) {
      console.log(`✓ 成功! 已保存到: ${outputName}`)
      console.log(`\n现在可以运行:`)
      console.log(`  npm run test-schematic-img ${outputName} analysis`)
      process.exit(0)
    }
  } catch (error) {
    console.log('  ImageMagick 不可用')
  }

  console.log('\n❌ 未找到可用的转换工具')
  console.log('\n手动转换方法:')
  console.log('  1. 用浏览器或PDF阅读器打开: ' + pdfPath)
  console.log('  2. 导航到第 ' + pageNum + ' 页')
  console.log('  3. 截图或导出为PNG格式')
  console.log('  4. 保存为: ' + outputName)
  console.log('\n或使用在线工具:')
  console.log('  https://www.ilovepdf.com/pdf_to_image')
  console.log('  https://smallpdf.com/pdf-to-jpg')
}

convertPdfToImage()
