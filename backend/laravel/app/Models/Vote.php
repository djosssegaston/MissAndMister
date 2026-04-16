<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vote extends Model
{
    /** @use HasFactory<\Database\Factories\VoteFactory> */
    use HasFactory, SoftDeletes;

    public const STATUS_CONFIRMED = 'confirmed';

    protected $fillable = [
        'user_id',
        'candidate_id',
        'payment_id',
        'amount',
        'quantity',
        'currency',
        'status',
        'ip_address',
        'meta',
    ];

    protected $casts = [
        'amount' => 'float',
        'meta' => 'array',
        'quantity' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeConfirmed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_CONFIRMED);
    }

    public function scopeSuccessful(Builder $query): Builder
    {
        return $query
            ->confirmed()
            ->where(function (Builder $query) {
                $query
                    ->whereNull('payment_id')
                    ->orWhereHas('payment', fn (Builder $paymentQuery) => $paymentQuery->succeeded());
            });
    }

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }
}
