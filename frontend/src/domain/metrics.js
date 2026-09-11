export function metrics(requests) {
  const closed = requests.filter((p) => p.finalReceivedAt);
  const onTime = closed.filter(
    (p) =>
      p.expectedAt && new Date(p.finalReceivedAt) <= new Date(p.expectedAt),
  ).length;
  const full = closed.filter((p) =>
    p.items.every((l) => (p.finalReceived?.[l.itemId] ?? 0) >= l.approvedQty),
  ).length;
  const percent = (n, d) => (d ? Math.round((n / d) * 100) : null);
  return {
    total: requests.length,
    onTime: percent(onTime, closed.length),
    inFull: percent(full, closed.length),
    emergencies: percent(
      requests.filter((p) => p.isEmergency).length,
      requests.length,
    ),
    rectified: percent(
      requests.filter((p) => p.isRectified).length,
      requests.length,
    ),
    leadHours: closed.length
      ? Math.round(
          (closed.reduce(
            (s, p) =>
              s +
              (new Date(p.finalReceivedAt) - new Date(p.createdAt)) / 3600000,
            0,
          ) /
            closed.length) *
            10,
        ) / 10
      : null,
  };
}
