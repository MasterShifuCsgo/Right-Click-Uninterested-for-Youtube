// ==UserScript==
// @name         Right-Click Uninterested for Youtube
// @namespace    https://github.com/yourname
// @version      1.5.0
// @description  Right‑click anywhere on a video card instantly triggers YouTube’s “Not interested”. No extra on‑screen buttons.
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  /************************ CONFIG ***************************/
  const MENU_TIMEOUT_MS   = 800;   // Wait for YT context menu
  const CLICK_DELAY_MS    = 60;    // Delay before clicking item
  const ACTION_GAP_MS     = 250;   // Gap between queued actions

  /************************ STATE ***************************/
  const queued  = new WeakSet();   // Cards waiting to be processed
  const removed = new WeakSet();   // Cards already removed
  const queue   = [];              // FIFO queue
  let   busy    = false;           // Processing flag

  /*********************** HELPERS **************************/
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const cardSel = 'ytd-rich-item-renderer, ytd-video-renderer';

  function synthClick(el){
    if(!el) return;
    ['pointerdown','mousedown','pointerup','mouseup','click']
      .forEach(t => el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window})));
  }

  async function waitForMenu(){
    let popup = [...document.querySelectorAll('ytd-menu-popup-renderer')].pop();
    if(popup) return popup;
    return new Promise(res => {
      const obs = new MutationObserver(() => {
        popup = [...document.querySelectorAll('ytd-menu-popup-renderer')].pop();
        if(popup){ obs.disconnect(); res(popup); }
      });
      obs.observe(document.documentElement,{childList:true, subtree:true});
      setTimeout(() => { obs.disconnect(); res(null); }, MENU_TIMEOUT_MS);
    });
  }

  async function removeCard(card){
    const menuBtn = card.querySelector('ytd-menu-renderer button');
    if(!menuBtn) return;
    synthClick(menuBtn);
    const menu = await waitForMenu();
    if(!menu) return;
    const item = [...menu.querySelectorAll('ytd-menu-service-item-renderer')]
                   .find(el => /Not interested/i.test(el.textContent));
    if(!item) return;
    await delay(CLICK_DELAY_MS);
    synthClick(item.querySelector('tp-yt-paper-item, #endpoint, yt-formatted-string') || item);
    removed.add(card);
  }

  /*********************** QUEUE *****************************/
  function enqueue(card){
    if(queued.has(card) || removed.has(card)) return;
    queued.add(card);
    queue.push(card);
    if(!busy) processQueue();
  }

  async function processQueue(){
    if(queue.length === 0){ busy = false; return; }
    busy = true;
    const card = queue.shift();
    try{ await removeCard(card);}catch{}
    await delay(ACTION_GAP_MS);
    processQueue();
  }

  /****************** EVENT INJECTION ************************/
  function addRightClick(card){
    if(card.__rcInjected) return;
    card.__rcInjected = true;
    card.addEventListener('contextmenu', e => {
      if(e.button !== 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      enqueue(card);
    }, {capture:true});
  }

  /****************** MUTATION OBSERVER **********************/
  function processNode(node){
    if(node.nodeType !== 1) return;
    if(node.matches?.(cardSel)) addRightClick(node);
    node.querySelectorAll?.(cardSel).forEach(addRightClick);
  }

  const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(processNode)));

  /************************* BOOT *****************************/
  (function init(){
    const root = document.querySelector('ytd-app');
    if(!root) return setTimeout(init, 500);
    root.querySelectorAll(cardSel).forEach(addRightClick);
    mo.observe(root, {childList:true, subtree:true});
  })();

  /* ================= CHANGELOG =============================
     v1.5.0:  – Removed all on‑screen red buttons; interaction is now
                right‑click only.
  ===========================================================*/
})();
