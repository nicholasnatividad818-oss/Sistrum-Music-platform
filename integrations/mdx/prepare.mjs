/**
 * NRN / SEYDANIC -> MDX preflight only.
 * No transport, account access, publishing, or vendor-specific DDEX serialization.
 * Official MDX message version and API contract must be obtained during onboarding.
 */
const isrcPattern = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function prepareMdxCatalog(records) {
  if (!Array.isArray(records)) throw new TypeError('Expected an array of catalog records');
  const seen = new Set();
  return records.map((record, index) => {
    const errors = [];
    const warnings = [];
    const title = record?.title?.trim?.() || '';
    const isrc = String(record?.isrc ?? '').replace(/[-\s]/g, '').toUpperCase();
    if (!title) errors.push('Missing recording title');
    if (!nonempty(record?.artist_name)) errors.push('Missing primary artist name');
    if (!isrcPattern.test(isrc)) errors.push('Missing or invalid ISRC (12 characters)');
    if (isrcPattern.test(isrc) && seen.has(isrc)) errors.push('Duplicate ISRC within this batch');
    if (isrcPattern.test(isrc)) seen.add(isrc);
    if (!nonempty(record?.catalog_track_id)) warnings.push('Missing source catalog_track_id for reconciliation');
    if (!nonempty(record?.work_title)) warnings.push('Missing musical work title / composition linkage');
    if (!nonempty(record?.publisher_name)) warnings.push('Missing publisher identity');
    if (!nonempty(record?.writer_name)) warnings.push('Missing writer identity');
    if (!nonempty(record?.iswc)) warnings.push('ISWC unavailable (not necessarily assigned)');
    if (!nonempty(record?.recording_rights_owner)) warnings.push('Recording rightsholder not supplied');
    if (record?.publisher_share_percent != null) {
      const share = Number(record.publisher_share_percent);
      if (!Number.isFinite(share) || share < 0 || share > 100) errors.push('Publisher share must be 0-100');
    } else {
      warnings.push('Publisher share not supplied; do not infer ownership');
    }
    return {
      index, source_id: record?.catalog_track_id ?? null, isrc: isrc || null,
      title, artist_name: record?.artist_name ?? null,
      status: errors.length ? 'blocked' : warnings.length ? 'needs_review' : 'preflight_ready',
      errors, warnings,
      // Keep source record local; this output is a REVIEW artifact, not an MDX message.
    };
  });
}
