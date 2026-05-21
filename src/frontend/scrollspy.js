// scrollspy.js - IntersectionObserver 滚动监听 (已整合到 render.js)
// 保留此文件用于未来独立管理，当前导出空实现

let scrollObserver = null;
let animationFrameId = null;

export function initScrollSpy() {
    // scroll spy 已在 render.js 的 setupScrollSpyNow() 中实现
    // 此模块保留用于解耦
}

export function cleanup() {
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}
