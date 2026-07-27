<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Billetterie Configuration
    |--------------------------------------------------------------------------
    |
    | Configure billetterie behavior. Set skip_payment to true to bypass
    | FedaPay payment flow (for local testing only).
    |
    */

    'skip_payment' => (bool) env('BILLETTERIE_SKIP_PAYMENT', false),

];
