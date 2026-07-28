<?php

namespace App\Console\Commands;

use App\Jobs\SendTicketEmailJob;
use App\Models\TicketOrder;
use Illuminate\Console\Command;

class RetryTicketEmails extends Command
{
    protected $signature = 'billetterie:retry-emails
        {--limit=50 : Maximum number of orders to process}
        {--dry-run : Show what would be sent without actually dispatching}';

    protected $description = 'Resend ticket emails for paid orders that may not have received their email (e.g. mail was misconfigured)';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        $dryRun = $this->option('dry-run');

        $orders = TicketOrder::with(['tickets', 'event'])
            ->where('status', 'paid')
            ->where('delivery_method', '!=', 'whatsapp')
            ->orderBy('created_at', 'asc')
            ->limit($limit)
            ->get();

        if ($orders->isEmpty()) {
            $this->info('No paid orders found needing email retry.');

            return self::SUCCESS;
        }

        $sent = 0;
        $skipped = 0;

        foreach ($orders as $order) {
            $email = $order->user?->email ?? $order->holder_email;

            if (! $email) {
                $this->line("  Skip order #{$order->id}: no email address.");
                $skipped++;

                continue;
            }

            if ($dryRun) {
                $this->line("  Would send order #{$order->id} → {$email}");
                $sent++;

                continue;
            }

            SendTicketEmailJob::dispatch($order->id);
            $this->info("  Dispatched email for order #{$order->id} → {$email}");
            $sent++;
        }

        $this->info("Done. Dispatched: {$sent}, Skipped: {$skipped}");

        return self::SUCCESS;
    }
}
