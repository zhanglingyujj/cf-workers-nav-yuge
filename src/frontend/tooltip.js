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
                    tooltip.classList.remove('hidden');
                    tooltipVisible = true;
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

    const hideTooltipInternal = () => {
        if (tooltipVisible) {
            tooltip.classList.add('hidden');
            activeTarget = null;
            tooltipVisible = false;
        }
    };

    document.body.addEventListener('mousemove', updateTooltip, { passive: true });
    window.addEventListener('scroll', hideTooltipInternal, { passive: true });
}