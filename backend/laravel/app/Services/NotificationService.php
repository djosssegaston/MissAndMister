<?php

namespace App\Services;

use App\Models\Notification;
use Illuminate\Database\Eloquent\Model;

class NotificationService
{
    public function send(Model $notifiable, string $title, string $body, array $data = []): Notification
    {
        return $notifiable->notifications()->create([
            'type' => 'app',
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'status' => 'active',
        ]);
    }
}
