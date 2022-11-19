import { useRef, useState, useEffect, memo, useCallback, useMemo } from 'react';
import { getFixedWidthText, getClassNames } from './utils';
import './index.scss';

type ProcessType = 'shadow' | 'ellipsis';
type ProcessTypeArr = ['shadow', 'ellipsis'];

interface TextProcessProps {
  type?: ProcessType; // 文案处理类型
  isDefaultFold?: boolean; // 是否默认折叠，false为默认展开
  isRenderShowAllDOM?: boolean; // 是否渲染被隐藏的全部文案展示DOM
  // clickEffectType?: 'default' | 'modal'; // 点击按钮效果
  unfoldButtonText?: string  | JSX.Element | JSX.Element[]; // 展开时按钮文案
  foldButtonText?: string  | JSX.Element | JSX.Element[]; // 折叠时按钮文案
  buttonBeforeSlot?: string | JSX.Element | JSX.Element[]; // 按钮前面的空格可以传''空去除
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  text: string; // 文本内容，shadow时支持传DOM（注：尽量传string文案）
  lineHeight?: number;
  ellipsisLineClamp?: number; // type类型为ellipsis时控制显示的行数
  className?: string;
  style?: React.CSSProperties;
  isShowAllContent?: boolean; // 当选择展示所有内容时将不提供操作按钮
  isMustButton?: boolean; // 是否常驻显示按钮
  isMustNoButton?: boolean; // 是否不要显示按钮
  shadowInitBoxShowH?: number; // shadow时显示的高度，超出这个高度才出现操作按钮
  onClick?: () => void;
  getIsFold?: (v: boolean) => void; // 获取文案是否超出范围被折叠
  /**
   * 是否使用Js逻辑计算文字开始折叠时显示的文案，可以传字号大小
   * 注意：
   * 1、启用此功能是为了兼容部分浏览器不支持display: -webkit-box;属性的使用（或出现异常）
   * 2、计算出来的文案可能不够完美，可能存在按钮被挤到下面的情况
   * 3、这时只支持传string类型内容
   * 4、按钮文案尽量传DOM结构
   */
  isJsComputed?: boolean;
  fontSize?: number; // 字号大小，不传时，字号大小默认12，计算出来的结果会有误差
}

const TYPE: ProcessTypeArr = ['shadow', 'ellipsis'];

function TextOverflowProcessor(props: TextProcessProps) {

  const {
    type,
    isDefaultFold,
    isRenderShowAllDOM,
    unfoldButtonText,
    foldButtonText,
    buttonBeforeSlot,
    buttonClassName,
    buttonStyle,
    text,
    lineHeight,
    ellipsisLineClamp,
    className,
    style,
    isShowAllContent,
    isMustButton,
    isMustNoButton,
    shadowInitBoxShowH,
    onClick,
    getIsFold,
    isJsComputed,
    fontSize,
  } = props;

  // 文案是否折叠
  const [isFold, setIsFold] = useState<boolean>(true);
  // 判断是否出现操作按钮
  const [isShowBtn, setIsShowBtn] = useState<boolean>(false);
  // 文案可视区域DOM
  const viewingArea = useRef<HTMLParagraphElement>(null);
  // 文案整体容器DOM
  const textArea = useRef<HTMLSpanElement>(null);
  const shadowShowH = useRef<number>(66);

  // 使用js来计算展示的文案时使用
  const [width, setWidth] = useState(0);
  const computedList = useMemo(() => {
    let finalText = '', isFold = false;
    // 为了获取该组件的宽度，组件第一次render时按所有text文字显示
    if (width) {
      const sumWidth = width * (ellipsisLineClamp as number);
      const str = getFixedWidthText(text, sumWidth, fontSize);
      // 如果返回有省略号，说明文字超出了范围
      if (str?.endsWith('...')) {
        isFold = true;
        setIsShowBtn(true);
      }
      if (isFold) {
        // 需要展示按钮时
        if ((foldButtonText || isMustButton) && !isMustNoButton) {
          const span = document.createElement('span');
          span.style.visibility = 'hidden';
          span.style.padding = '0';
          span.style.whiteSpace = 'nowrap';
          span.style.overflowX = 'auto';
          span.style.fontSize = fontSize + 'px';
          document.body.appendChild(span);
          span.innerHTML = `...${foldButtonText}`;
          const sumWidth = width * (ellipsisLineClamp as number) - span.offsetWidth;
          document.body.removeChild(span);
          finalText = getFixedWidthText(
            text,
            sumWidth - 10, // 由于计算出来的文案有精确度误差，屏幕缩放时保留10px范围距离确保按钮不会被挤下来
            fontSize,
          );
        } else {
          finalText = str?.substr(0, str.length - 6) + '...';
        }
      } else {
        finalText = text;
      }
    }
    getIsFold?.(isFold);

    return {
      finalText,
      isFold,
    };
  }, [
    text,
    width,
    ellipsisLineClamp,
    foldButtonText,
    fontSize,
    isMustButton,
    isMustNoButton,
  ]);

  const getIsShowBtn = useCallback(() => {
    const childrens: any = textArea.current?.childNodes;
    let childSumH: number = 0; // 所有子元素标签加起来的高度
    for (let i = 0; i < childrens?.length; i++) {
      const t = childrens?.[i];
      childSumH += t?.offsetHeight;
    }
    // @ts-ignore
    const shadowFlag = type === 'shadow' && textArea?.current?.offsetHeight > shadowShowH.current;
    // @ts-ignore
    const generalFlag = textArea?.current?.offsetHeight > viewingArea?.current?.clientHeight;
    
    if (!!childSumH) {
      return (shadowFlag && childSumH > shadowShowH.current) || generalFlag;
    } else {
      return shadowFlag || generalFlag;
    }
  }, []);

  const handleResize = useCallback(() => {
    if (isJsComputed && viewingArea?.current) {
      setWidth(viewingArea?.current?.getBoundingClientRect()?.width || 0);
    } else {
      if (getIsShowBtn()) {
        isMustNoButton || setIsShowBtn(true);
        getIsFold?.(true);
      } else {
        isMustButton || setIsShowBtn(false);
        // 当isMustButton为true时，按钮占据一定空间，此时文案可能因此被折叠而返回结果有误，待优化...
        getIsFold?.(false);
      }
    }
  }, [isMustButton]);

  const handleClick = useCallback(() => {
    onClick ? onClick?.() : setIsFold(!isFold);
  }, [isFold]);

  const getButtonContent = useCallback(() => {
    return isFold ? foldButtonText : unfoldButtonText ;
  }, [isFold, unfoldButtonText, foldButtonText]);

  const getButtonStyle = useCallback(() => {
    const defalutStyle = {
      display: isShowBtn ? 'inline-block' : 'none',
      lineHeight: lineHeight + 'px',
    };

    if (Object.prototype.toString.call(buttonStyle) !== '[object Object]') {
      console.error('buttonStyle格式不正确！');
      return defalutStyle;
    }

    return Object?.assign(defalutStyle, buttonStyle);
  }, [isShowBtn, lineHeight, buttonStyle]);

  // 初始化判断是否显示操作按钮
  useEffect(() => {
    if (!TYPE.includes(type as ProcessType)) {
      console.error('文案处理类型type不在可选范围！');
      return;
    }
    if (isShowAllContent) {
      getIsFold?.(false);
      setIsFold(false);
      return;
    }
    // @ts-ignore
    shadowShowH.current = shadowInitBoxShowH - 10; // 减去shadow阴影的一半高度

    if (getIsShowBtn()) {
      getIsFold?.(isDefaultFold as boolean);
      setIsFold(isDefaultFold as boolean);
      setIsShowBtn(true);
    } else {
      getIsFold?.(false);
    }

    if (isMustButton) setIsShowBtn(true);
    if (isMustNoButton) setIsShowBtn(false);
    if (isJsComputed) handleResize();

    // 页面缩放时判断是否显示操作按钮
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    }
  }, [text]);

  return (
    <section className={`text-overflow-processor-content ${className}`} style={style}>
      {isRenderShowAllDOM && <p className="all-text text-overflow-processor-off" style={{display: 'none'}} dangerouslySetInnerHTML={{ __html: text }}></p>}
      <p
        ref={viewingArea}
        className={getClassNames({
          'text-overflow-processor-on': true,
          'p-shadow-info': type === 'shadow',
          'p-ellipsis-info': type === 'ellipsis',
          'text-show-less': isFold && type !== 'shadow',
          'text-show-all': !isFold,
        })}
        style={{
          display: isJsComputed ? 'inline-block' : '',
          WebkitLineClamp: ellipsisLineClamp,
          lineHeight: lineHeight + 'px',
        }}
      >
        {type === 'shadow' && (
          <>
            <span
              ref={textArea}
              className={getClassNames({
                'text': true,
                'text-show-btn-box': isShowBtn,
                'text-show-all-box': !isFold,
              })}
              style={{height: isShowBtn ? shadowInitBoxShowH : 'auto'}}
              dangerouslySetInnerHTML={{ __html: text }}
            ></span>
            {(isShowBtn && isFold) && (
              <span className="shadow" style={{bottom: lineHeight}}></span>
            )}
            <span
              className={getClassNames({
                'click-btn': true,
                [buttonClassName as string]: !!buttonClassName,
              })}
              style={getButtonStyle()}
            >
              <label onClick={handleClick}>{getButtonContent()}</label>
            </span>
          </>
        )}
        {type === 'ellipsis'
          ? (
            <>
              {isMustNoButton || (
                <i
                  className="click-btn-before"
                  style={{height: `calc(100% - ${lineHeight}px)`}}
                ></i>
              )}
              <span
                className={getClassNames({
                  'click-btn': true,
                  [buttonClassName as string]: !!buttonClassName,
                })}
                style={getButtonStyle()}
              >
                {buttonBeforeSlot === undefined
                  ? (isJsComputed ? null : <>&nbsp;&nbsp;&nbsp;&nbsp;</>)
                  : buttonBeforeSlot
                }
                <label onClick={handleClick}>{getButtonContent()}</label>
              </span>
              <span
                ref={textArea}
                className="text"
                dangerouslySetInnerHTML={{ __html: (isJsComputed && isFold) ? computedList?.finalText || '' : text }}
              ></span>
            </>
          )
          : null}
      </p>
    </section>
  )
}

TextOverflowProcessor.defaultProps = {
  // text: 'In all the parting, I like it best see you tomorrow.Of all the blessings I prefer, as you wish. Sometimes you look at the wrong person, not because you are jealous, but because you are kind. You never know how strong you really are until being strong is the only choice you have. Never bend your head. Always hold it high. Look the world straight in the face. Life is alive, there is not much, only helpless. Life is a wonderful journey. Make it your journey and not someone else\'s.',
  type: 'shadow',
  isDefaultFold: true,
  isRenderShowAllDOM: false,
  unfoldButtonText: 'Show Less',
  foldButtonText: 'Show All',
  buttonBeforeSlot: undefined,
  buttonClassName: '',
  buttonStyle: {},
  text: '',
  lineHeight: 24,
  ellipsisLineClamp: 2,
  className: '',
  style: {},
  isShowAllContent: false,
  isMustButton: false,
  isMustNoButton: false,
  shadowInitBoxShowH: 76,
  onClick: null,
  getIsFold: null,
  isJsComputed: false,
  fontSize: 12,
}

export default memo(TextOverflowProcessor);
