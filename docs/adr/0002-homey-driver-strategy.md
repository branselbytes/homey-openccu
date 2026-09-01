# ADR 0002: Homey driver strategy

- Status: accepted
- Date: 2026-09-01

## Context

OpenCCU exposes devices dynamically, while Homey drivers and their manifests are product-facing and static. The project also needs useful behavior for previously unknown products.

## Decision

- Every explicitly supported Homematic IP product has its own Homey driver.
- Common behavior is implemented in shared typed profiles and mapping services, not copied between driver implementations.
- A separate generic fallback driver exposes safe capabilities for new or unsupported products and produces detailed diagnostics.
- New product support promotes a proven generic mapping into a dedicated driver/profile with fixtures and tests.

## Consequences

Users retain recognizable per-product pairing and presentation. The manifest remains larger than a purely generic approach, so generation and consistency checks will be needed. The generic driver reduces the delay between encountering a new product and diagnosing or partially using it.
