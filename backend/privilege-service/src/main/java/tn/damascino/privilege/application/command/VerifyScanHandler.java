package tn.damascino.privilege.application.command;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.damascino.common.cqrs.CommandHandler;
import tn.damascino.privilege.application.ScanEvaluator;
import tn.damascino.privilege.application.ScanEvaluator.Evaluation;
import tn.damascino.privilege.application.ScanResult;
import tn.damascino.privilege.projection.BeneficiaryProjection;
import tn.damascino.privilege.projection.PartnerProjection;

@Component
public class VerifyScanHandler implements CommandHandler<VerifyScanCommand, ScanResult> {

    private final ScanEvaluator evaluator;

    public VerifyScanHandler(ScanEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @Override
    @Transactional
    public ScanResult handle(VerifyScanCommand command) {
        Evaluation evaluation = evaluator.evaluate(command.token(), false);
        if (!evaluation.accepted()) {
            return evaluator.refuse(evaluation, command.staff(), "VERIFY");
        }
        BeneficiaryProjection b = evaluation.beneficiary();
        PartnerProjection p = evaluation.partner();
        return new ScanResult(ScanResult.Status.VALID, null, "Avantage valide", b.fullName(), p.getName(),
                p.getDiscountPercent(), p.getEligibleCategories(), p.getExcludedCategories(),
                (int) (p.getUsagesPerPeriod() - evaluation.usedInPeriod()), null, null, null, null);
    }
}
