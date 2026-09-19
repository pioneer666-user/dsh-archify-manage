// 模板预处理的纯函数部分（零外网，验收 #10）。不含 DOM，Node 可直接加载验证。
// vendor 模板自带 Google Fonts 外链（preconnect + stylesheet + noscript 兜底）；
// 离线时不阻塞首屏（模板自己有系统等宽字体回退），但在线时会向第三方发请求。
// 装配前剥掉这些 <link>：正文回退系统等宽字体，满足零外网。
export function stripExternalFonts(html) {
  return html.replace(/<link[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/gi, '')
}
