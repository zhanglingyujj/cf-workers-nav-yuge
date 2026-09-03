// drag.js - 拖拽排序 (PC + 移动端) ★ 本地优先 + 合并异步保存
import { isEditMode, getCategories, reorderCards, findLinkById } from './state.js';
import { patchCategory, renderAll } from './render.js';
import { commitSoon } from './commit.js';

let draggedCard = null;
let initialDragState = { category: null, index: -1 };

function getCardState(card) {
    if (!card) return { category: null, index: -1 };
    const section = card.closest('.section');
    const index = Array.from(section.querySelectorAll('.card')).indexOf(card);
    return { category: section.id, index };
}

function dragStart(e) {
    if (!isEditMode()) { e.preventDefault(); return; }
    draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = "move";
    initialDragState = getCardState(this);
}

function dragOver(e) {
    if (!isEditMode()) return;
    e.preventDefault();
    const target = e.target.closest('.card');
    if (target && target !== draggedCard) {
        const container = target.parentElement;
        const rect = target.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            container.insertBefore(draggedCard, target);
        } else {
            container.insertBefore(draggedCard, target.nextSibling);
        }
    }
}

function dragEnd() {
    if (draggedCard) draggedCard.classList.remove('dragging');
}

async function drop(e) {
    if (!isEditMode()) return;
    e.preventDefault();
    if (!draggedCard) return;

    const newState = getCardState(draggedCard);
    const changed = newState.category !== initialDragState.category || newState.index !== initialDragState.index;
    if (changed) {
        updateCardCategory(draggedCard, newState.category);
        const newLinks = readLinksFromDOM(newState.category);
        reorderCards(newState.category, newLinks);
if (initialDragState.category !== newState.category) {
            renderAll();
        } else {
            patchCategory(newState.category);
        }
        debouncedSaveOrder();
    }
    draggedCard = null;
}

// 合并高频拖拽的落库（300ms 尾沿）
function debouncedSaveOrder() {
    commitSoon('保存排序');
}

function updateCardCategory(card, newCategory) {
    const id = card.getAttribute('data-card-id');
    let item = null;
    const categories = getCategories();
    for (const cat in categories) {
        const idx = categories[cat].links.findIndex(l => l.id === id);
        if (idx !== -1) {
            item = categories[cat].links.splice(idx, 1)[0];
            break;
        }
    }
    if (item) {
        item.category = newCategory;
        categories[newCategory].links.push(item);
    }
}

function readLinksFromDOM(categoryName) {
    const section = document.getElementById(categoryName);
    if (!section) return [];
const cards = section.querySelectorAll('.card:not(.add-card-placeholder)');
    return Array.from(cards).map(c => findLinkById(c.getAttribute('data-card-id'))).filter(Boolean);
}

// -------- 移动端拖拽 --------
let mobileDragTimer = null;
let isMobileDragging = false;
let mobilePlaceholder = null;
let mobileClone = null;
let mobileTouchOffset = { x: 0, y: 0 };
let rafId = null;
let lastTouchX = 0;
let lastTouchY = 0;
let lastSwapTime = 0;
let activeContainer = null;
let cloneWidth = 0;
let cloneHeight = 0;

function touchStart(e) {
    if (!isEditMode()) return;
    if (e.touches.length > 1) return;

    const card = e.target.closest('.card');
    if (!card) return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    if (mobileDragTimer) clearTimeout(mobileDragTimer);

    mobileDragTimer = setTimeout(() => {
        isMobileDragging = true;
        mobilePlaceholder = card;
        activeContainer = mobilePlaceholder.parentElement;
        initialDragState = getCardState(mobilePlaceholder);

        const rect = mobilePlaceholder.getBoundingClientRect();
        cloneWidth = rect.width;
        cloneHeight = rect.height;
        mobileTouchOffset.x = startX - rect.left;
        mobileTouchOffset.y = startY - rect.top;
        lastTouchX = startX;
        lastTouchY = startY;

        mobileClone = mobilePlaceholder.cloneNode(true);
        Object.assign(mobileClone.style, {
            position: 'fixed',
            left: rect.left + 'px',
            top: rect.top + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px',
            zIndex: '9999',
            opacity: '0.95',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            transform: 'scale(1.05)',
            transition: 'none'
        });
        mobileClone.classList.add('card-clone-dragging');
        mobileClone.classList.remove('group', 'hover:-translate-y-1', 'transition-all', 'duration-300');
        document.body.appendChild(mobileClone);

        mobilePlaceholder.style.opacity = '0.3';
        mobilePlaceholder.classList.add('border-dashed', 'border-2', 'border-heritage-400');

        if (navigator.vibrate) navigator.vibrate(50);
        updatePosition();
    }, 500);

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    function updatePosition() {
        if (!isMobileDragging || !mobileClone) return;
        const x = lastTouchX - mobileTouchOffset.x;
        const y = lastTouchY - mobileTouchOffset.y;
        mobileClone.style.left = x + 'px';
        mobileClone.style.top = y + 'px';
        rafId = requestAnimationFrame(updatePosition);
    }

    function handleTouchMove(moveEvent) {
        const moveTouch = moveEvent.touches[0];
        if (!isMobileDragging) {
            const diffX = moveTouch.clientX - startX;
            const diffY = moveTouch.clientY - startY;
            if (Math.hypot(diffX, diffY) > 10) {
                clearTimeout(mobileDragTimer);
                mobileDragTimer = null;
            }
            return;
        }
        if (Math.abs(moveTouch.clientX - startX) > Math.abs(moveTouch.clientY - startY)) {
            moveEvent.preventDefault();
        }
        lastTouchX = moveTouch.clientX;
        lastTouchY = moveTouch.clientY;
        const now = Date.now();
        if (now - lastSwapTime > 50) {
            detectSort(moveTouch.clientX, moveTouch.clientY);
        }
    }

    function detectSort(fingerX, fingerY) {
        let elementBelow = document.elementFromPoint(fingerX, fingerY);
        if (!elementBelow) return;
        let targetCard = elementBelow.closest('.card') || elementBelow.closest('.add-card-placeholder');
        let targetContainer = targetCard ? targetCard.parentElement : elementBelow.closest('.card-container');
        if (!targetContainer) return;

        if (activeContainer !== targetContainer) {
            activeContainer = targetContainer;
            const placeholderBtn = activeContainer.querySelector('.add-card-placeholder');
            if (placeholderBtn) {
                activeContainer.insertBefore(mobilePlaceholder, placeholderBtn);
            } else {
                activeContainer.appendChild(mobilePlaceholder);
            }
            lastSwapTime = Date.now();
            return;
        }

        const containerRect = activeContainer.getBoundingClientRect();
        const cloneViewportCenterX = lastTouchX - mobileTouchOffset.x + cloneWidth / 2;
        const cloneViewportCenterY = lastTouchY - mobileTouchOffset.y + cloneHeight / 2;
        const cloneRelX = cloneViewportCenterX - containerRect.left + activeContainer.scrollLeft;
        const cloneRelY = cloneViewportCenterY - containerRect.top + activeContainer.scrollTop;

        const siblings = Array.from(activeContainer.children).filter(c =>
            (c.classList.contains('card') || c.classList.contains('add-card-placeholder')) && c !== mobilePlaceholder
        );
        if (siblings.length === 0) return;

        let closestElement = null;
        let minDistance = Infinity;
        for (const child of siblings) {
            const childCenterX = child.offsetLeft + child.offsetWidth / 2;
            const childCenterY = child.offsetTop + child.offsetHeight / 2;
            const dist = Math.hypot(cloneRelX - childCenterX, cloneRelY - childCenterY);
            if (dist < minDistance) {
                minDistance = dist;
                closestElement = child;
            }
        }

        if (closestElement) {
            const positionsBefore = new Map();
            const allChildren = Array.from(activeContainer.children).filter(el =>
                el.classList.contains('card') || el.classList.contains('add-card-placeholder')
            );
            allChildren.forEach(el => positionsBefore.set(el, el.getBoundingClientRect()));
            const placeholderIndex = allChildren.indexOf(mobilePlaceholder);
            const targetIndex = allChildren.indexOf(closestElement);
            if (targetIndex > placeholderIndex) {
                activeContainer.insertBefore(mobilePlaceholder, closestElement.nextSibling);
            } else {
                activeContainer.insertBefore(mobilePlaceholder, closestElement);
            }
            animateFlip(activeContainer, positionsBefore);
            lastSwapTime = Date.now();
            if (navigator.vibrate) navigator.vibrate(10);
        }
    }

    function animateFlip(container, positionsBefore) {
        const siblings = Array.from(container.children);
        siblings.forEach(el => {
            if (el === mobilePlaceholder) return;
            const rectAfter = el.getBoundingClientRect();
            const rectBefore = positionsBefore.get(el);
            if (rectBefore && (rectBefore.left !== rectAfter.left || rectBefore.top !== rectAfter.top)) {
                const dx = rectBefore.left - rectAfter.left;
                const dy = rectBefore.top - rectAfter.top;
                el.style.transition = 'none';
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                el.offsetHeight;
                el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
                el.style.transform = '';
                setTimeout(() => {
                    if (el.style.transform === '') el.style.transition = '';
                }, 200);
            }
        });
    }

function handleTouchEnd() {
        if (mobileDragTimer) { clearTimeout(mobileDragTimer); mobileDragTimer = null; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

        if (isMobileDragging) {
            if (mobileClone && mobilePlaceholder) {
                const rect = mobilePlaceholder.getBoundingClientRect();
                mobileClone.style.transition = 'all 0.2s ease-out';
                mobileClone.style.left = rect.left + 'px';
                mobileClone.style.top = rect.top + 'px';
                mobileClone.style.opacity = '0';
                setTimeout(() => {
                    if (mobileClone) { mobileClone.remove(); mobileClone = null; }
                    if (mobilePlaceholder) {
                        mobilePlaceholder.style.opacity = '';
                        mobilePlaceholder.classList.remove('border-dashed', 'border-2', 'border-heritage-400');
                        const newState = getCardState(mobilePlaceholder);
                        const changed = newState.category !== initialDragState.category || newState.index !== initialDragState.index;
                        if (changed) {
                            updateCardCategory(mobilePlaceholder, newState.category);
                            const newLinks = readLinksFromDOM(newState.category);
                            reorderCards(newState.category, newLinks);
                            if (initialDragState.category !== newState.category) {
                                renderAll();
                            } else {
                                patchCategory(newState.category);
                            }
                            debouncedSaveOrder();
                        }
                        mobilePlaceholder = null;
                    }
                    document.body.style.overflow = '';
                }, 200);
            } else {
                if (mobileClone) { mobileClone.remove(); mobileClone = null; }
                if (mobilePlaceholder) { mobilePlaceholder.style.opacity = ''; mobilePlaceholder = null; }
            }
        }
        isMobileDragging = false;
        cleanupListeners();
    }

    function cleanupListeners() {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
    }
}

export function initDrag(container) {
    container.addEventListener('touchstart', touchStart, { passive: false });
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.card') && isEditMode()) dragStart.call(e.target.closest('.card'), e);
    }, { capture: true });
    document.addEventListener('dragover', dragOver, { capture: true });
    document.addEventListener('dragend', (e) => {
        if (e.target.closest('.card')) dragEnd.call(e.target.closest('.card'));
    });
    document.addEventListener('drop', drop, { capture: true });
}
