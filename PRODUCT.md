# Mira Workbench Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vue 3, TypeScript, and Vite, matching the Mira shell and the existing micro-app build model.

## Users

Mira desktop users who regularly visit AI assistants and search websites while working.

## Product Purpose

Workbench is Mira's second, optional, standalone sub-application. It gathers built-in and user-added websites and opens them inside Mira so users can keep common web tools together.

## Positioning

Workbench is selected alongside Harness from the Mira home application selector. It is a website collection and in-app browsing surface, not a Harness page or an executable MiniApp.

## Operating Context

Workbench runs as a desktop sub-application hosted by Mira. Its first release is a searchable collection of websites with internal tabs; the collection remains available while users work in opened sites.

Mira owns the native title bar, application selector, and window-level actions. Everything below that title bar belongs to the selected application: switching from Harness replaces its sidebar and workspace with Workbench. Workbench fills the host-provided width and height without reserving title-bar space. Its 44px internal toolbar contains website tabs, display management, and the add-site action. The collection scrolls independently; the browser toolbar stays above the remaining website viewport.

## Capabilities and Constraints

- The first built-in collection contains 17 sites supplied by the user; names and URLs are recorded in `src/data/sites.ts`.
- Users can search the collection, open multiple internal tabs, and manage custom site entries locally.
- The host must isolate remote websites from Mira's privileged APIs. Website embedding and login compatibility vary by provider; blocked sites need a system-browser fallback.
- Local MiniApp packages, remote directories, account sync, and mobile layouts are outside the first release.
- Default sign-in persistence and website permission policy remain technical decisions for host integration.

## Brand Commitments

Use the supplied Mira Workbench logo at `public/mira-workbench-logo.png`. The user referenced Cherry Studio's search, add, and site-collection interaction as a functional model.

## Evidence on Hand

- User-provided logo: `mira-workbench-logo.png`.
- User-provided first-release list of 17 websites in the project PRD and `src/data/sites.ts`.
- Mira Harness source provides an existing Vue shell and `@lobehub/icons-static-svg` AI brand icon mapping for most sites.
