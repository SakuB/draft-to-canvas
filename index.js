function handleFormatColor (col, key) {
  const colArr = col.split('@');
  return {
    [`${key}Color`]: colArr[0],
    [`${key}Alpha`]: parseFloat(colArr[1]),
  };
}

// 获取数据
const data = JSON.parse(decodeURI(searchParse().data));
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const render = document.querySelector('#render');
console.log(data);
// 获取背景颜色
const color = handleFormatColor(data.bg_color, 'bg');
const rgb = colr.fromHex(color.bgColor).toRgbArray();
canvas.width = data.w;
canvas.height = data.h;
// 绘制背景矩形
ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${color.bgAlpha})`;
ctx.fillRect(0, 0, canvas.width, canvas.height);
/**
 * @param {*源数据} blocks 
 * 根据每一行的最大字体高度确定文字部分总高度
 * 通过总高度计算出第一行起始坐标
 */
function getMaxHeight(blocks) {
  let maxHeight = 0;
  let lineHeight = [];
  blocks.forEach((v, i) => {
    let max = 0;
    v.inlineStyleRanges.forEach((j, k) => {
      if (map[j.style]) {
        const obj = map[j.style];
        const keys = Object.keys(obj)[0];
        if (keys === 'fontSize') {
          const height = parseInt(obj['fontSize']);
          if (height > max) {
            max = height;
          }
          if (k === (v.inlineStyleRanges.length - 1)) {
            maxHeight = maxHeight + max * 1.4;
            lineHeight.push(Math.round(max * 1.4));
            max = 0;
          }
        }
      }
    });
  });
  return {
    height:  Math.round(maxHeight),
    lineHeight: lineHeight,
  };
}

const { height, lineHeight } = getMaxHeight(data.raw.blocks);
let startY = Math.round((data.h - height) / 2);

data.raw.blocks.forEach((v, i) => {
  const inlineCanvas = document.createElement('canvas');
  const inlineCtx = inlineCanvas.getContext('2d');
  inlineCanvas.width = data.w;
  inlineCanvas.height = lineHeight[i];
  let blockW = 0;
  let nextBlockX = 0;
  inlineCtx.textBaseline = 'middle';
  inlineCtx.textAlign = 'left';
  inlineCtx.fillStyle = "#000";
  let textBaseLine = 0;
  const { lineStyles, lineWidth } = getBlockStyles(v.inlineStyleRanges, v.text.split(''));
  if (v.type !== 'unstyled') {
    if (v.type === 'left') {
      textBaseLine = 0;
    }
    /**
     * 居中
     * canvas文字对齐方式依赖文字渲染时的X坐标
     * 如果以单字的方式渲染，需要计算一行文字总宽度
     * 套用 (画布宽度 / 2) - (文字总宽度 / 2) + (第一个文字宽度 / 2)）来确定渲染第一个文字时的起始坐标
     * 后续文字根据前一个文字渲染时的基线X坐标 + 文字本身宽度 来确定渲染位置
     */
    if (v.type === 'center') {
      textBaseLine = data.w / 2 - lineWidth / 2 + lineStyles[0].offset / 2;
    }
    /**
     * 右对齐
     * 右对齐在canvas中实际文字位于基线左边
     * 单字方式渲染时 根据文字宽度动态计算每一个文字渲染时基线的位置
     * (画布宽度 / 2) - 文字总宽 + 第一个文字宽度 来确定渲染第一个文字的起始坐标
     */
    if (v.type === 'right') {
      textBaseLine = data.w - lineWidth + lineStyles[0].offset;
    }
    inlineCtx.textAlign = v.type;
  }
  lineStyles.forEach((j) => {
    let font = '';
    j.style.forEach((s) => {
      const keys = Object.keys(s)[0];
      if (keys === 'color') {
        inlineCtx.fillStyle = s[keys];
      }
      if (keys === 'fontSize' || keys === 'fontFamily') {
        font = `${font}${s[keys]} 'PingFang SC','Microsoft YaHei'`;
      }
    });
    inlineCtx.font = font;
    inlineCtx.fillText(j.text, textBaseLine, inlineCanvas.height / 2);
    /**
     * 每渲染完成一个文字 更新基线的位置为 当前位置+下一个文字宽度
     */
    textBaseLine = textBaseLine + j.offset;
  });
  ctx.drawImage(inlineCanvas, 0, startY);
  startY = startY + lineHeight[i];
});

/**
 * 
 * @param {*源数据} line
 * 将每一行的源数据按一个字一个对象的方式拆分开
 * 每个对象存放一个文字 一个样式数据和相对于前一个字的X坐标
 */
function getBlockStyles(line, text) {
  const lineStyles = [];
  let lineWidth = 0;
  text.reduce((pre, cur, i) => {
    let curStyle = {
      text: cur,
      style: [],
      offset: 0,
    };
    line.forEach((v, j) => {
      const t = text.slice(v.offset, v.offset + v.length);
      if (t.indexOf(cur) > -1) {
        if (v.style.startsWith('COLOR_')) {
          const rgba = `rgba(${v.style.split('COLOR_')[1]})`;
          curStyle.style.push({ color: rgba });
        } else {
          const styleObj = map[v.style];
          const keys = Object.keys(styleObj)[0];
          curStyle.style.push(styleObj);
          if (keys === 'fontSize') {
            const reg = /[\u4E00-\u9FA5\uF900-\uFA2D]/;
            if(reg.test(cur)) {
              lineWidth = lineWidth + parseInt(styleObj[keys]);
              curStyle.offset = parseInt(styleObj[keys]);
            } else {
              lineWidth = lineWidth + parseInt(styleObj[keys]) / 2;
              curStyle.offset = parseInt(styleObj[keys]) / 2;
            }
          }
        }
      }
    });
    lineStyles.push(curStyle);
  }, []);
  return {
    lineStyles,
    lineWidth,
  }
};

document.body.appendChild(canvas);
const base64 = canvas.toDataURL('image/png');
