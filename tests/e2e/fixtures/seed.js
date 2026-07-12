/**
 * Setup helpers for E2E suites — create test data via real IPC calls
 * (the same window.api.* surface the UI itself uses), not raw SQL, so
 * setup steps exercise real validation/service-layer code too. Reserved
 * for data that ISN'T itself under test in a given suite (e.g. a suite
 * testing invoice creation doesn't need to test-drive product creation
 * through the UI first — create the product via API, then test the UI
 * flow that actually matters).
 */

async function createTestCustomer(page, overrides = {}) {
  return page.evaluate(async (o) => {
    const res = await window.api.customers.create({
      customerName: o.customerName || `E2E Customer ${Date.now()}`,
      phone: o.phone || `9${String(Date.now()).slice(-9)}`,
      ...o,
    })
    return res
  }, overrides)
}

async function createTestProduct(page, overrides = {}) {
  return page.evaluate(async (o) => {
    const res = await window.api.products.create({
      productName: o.productName || `E2E Product ${Date.now()}`,
      productType: 'STANDARD',
      unit: 'PCS',
      costPrice: 100,
      sellingPrice: 150,
      taxRate: 18,
      openingQuantity: 100,
      ...o,
    })
    return res
  }, overrides)
}

module.exports = { createTestCustomer, createTestProduct }
