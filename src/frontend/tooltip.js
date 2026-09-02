// tooltip.js - 鼠标跟随 tooltip
export function initTooltip() {
    const tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) return;

    let activeTarget = null;
    let tooltipVisible = false;
    let lastUpdateTime = 0;

    const updateTooltip = (e) => {
        const now = Date.now();
        if (now - lastUpdateTime < 16) return;
        lastUpdateTime = now;

        const target = e.target.closest('.has-tooltip');
        if (target) {
            const text = target.getAttribute('data-tooltip');
            if (text) {
                if (activeTarget !== target) {
                    activeTarget = target;
                    tooltip.textContent = text;
                    showTooltip();
                }
                const offset = 12;
                let left = e.clientX + offset;
                let top = e.clientY + offset;
                const tooltipRect = tooltip.getBoundingClientRect();
                if (left + tooltipRect.width > window.innerWidth) {
                    left = e.clientX - tooltipRect.width - offset;
                }
                if (top + tooltipRect.height > window.innerHeight) {
                    top = e.clientY - tooltipRect.height - offset;
                }
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            } else {
                hideTooltipInternal();
            }
        } else {
            hideTooltipInternal();
        }
    };
    const showTooltip = () => {
        if (!tooltipVisible) {
            tooltip.classList.remove('opacity-0');
            tooltipVisible = true;
        }
    };

    const hideTooltipInternal = () => {
        if (tooltipVisible) {
            tooltip.classList.add('opacity-0');
            activeTarget = null;
            tooltipVisible = false;
        }
    };

    document.body.addEventListener('mousemove', updateTooltip, { passive: true });
    document.body.addEventListener('mouseleave', hideTooltipInternal);
    window.addEventListener('scroll', hideTooltipInternal, { passive: true });
    // 触摸设备：触摸开始即隐藏，长按不弹 tooltip
    document.body.addEventListener('touchstart', hideTooltipInternal, { passive: true });
}