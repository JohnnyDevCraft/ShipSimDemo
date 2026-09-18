# View Screen Settings — discovery

The Communications demo Settings tab has a second column, View Screen Settings, controlled by the communications officer. It configures a future view screen; these controls describe future production behavior. The standalone ViewScreen demo has its own footer controls.

- View Type: SRS, LRS, Dual.
- SRS Range, in displayed order: 1 BKM, 0.1 BKM, 0.01 BKM, 1 MKM, 0.1 MKM, 0.01 MKM, 10,000 km, 1,000 km, 100 km.
- LRS Range: 30 LY, 20 LY, 10 LY, 5 LY, 1 LY, 1 BKM.

The equivalent 0.01 MKM and 10,000 km choices are intentionally both retained as requested. Defaults are the first option in each list: SRS, 1 BKM, 30 LY. The demo keeps these selections for the current page session; it does not control other demos. A future implementation should persist shared ship view-screen configuration server-side and render the selected scanner modes and ranges there. Existing Contact settings remain alongside these controls.
